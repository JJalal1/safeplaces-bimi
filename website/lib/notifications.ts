import type {OperationsBindings, RequestRecord, RequestType} from './operations-types';

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const timestamp = () => new Date().toISOString();
const envText = (env: OperationsBindings, key: string) => typeof env[key] === 'string' ? String(env[key]).trim() : '';

/** Enabling outbound mail is an explicit server-side operation, never a CMS setting. */
export function notificationConfig(env: OperationsBindings) {
  const from = envText(env, 'NOTIFICATION_FROM') || envText(env, 'AUTH_EMAIL_FROM');
  if (env.EMAIL_NOTIFICATIONS_ENABLED !== 'true' || !emailPattern.test(from)) return null;
  const replyTo = envText(env, 'NOTIFICATION_REPLY_TO');
  const key = envText(env, 'RESEND_API_KEY');
  if (!key || /[\r\n]/.test(key)) return null;
  return {key, from, replyTo: emailPattern.test(replyTo) ? replyTo : undefined};
}

export function eventStatement(env: OperationsBindings, input: {
  type: RequestType; requestId: string; kind: string; actorId?: string | null; actorLabel?: string;
  visibility?: 'internal' | 'customer'; body?: string | null; fromStatus?: string | null;
  toStatus?: string | null; key?: string; createdAt?: string;
}) {
  return env.DB.prepare('INSERT INTO request_events (id,request_type,request_id,actor_id,actor_label,kind,visibility,body,from_status,to_status,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), input.type, input.requestId, input.actorId || null, input.actorLabel || 'Safe Places', input.kind,
      input.visibility || 'internal', input.body || null, input.fromStatus || null, input.toStatus || null, input.key || crypto.randomUUID(), input.createdAt || timestamp());
}

export function notificationStatement(env: OperationsBindings, input: {
  type: RequestType; requestId: string; kind: string; recipient: string; subject: string; body: string; key: string;
}) {
  const ready = !!notificationConfig(env) && emailPattern.test(input.recipient), time = timestamp();
  return env.DB.prepare('INSERT INTO notification_outbox (id,request_type,request_id,kind,recipient,subject,body,status,next_attempt_at,last_error,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), input.type, input.requestId, input.kind, input.recipient, input.subject, input.body,
      ready ? 'queued' : 'blocked', time, ready ? null : 'EMAIL_NOT_CONFIGURED', input.key, time, time);
}

/** Save notifications in the SAME D1 transaction as the incoming request. */
export function requestCreatedStatements(env: OperationsBindings, type: RequestType, record: Pick<RequestRecord, 'id' | 'name' | 'email'> & {number?: string}) {
  const reference = record.number || 'SPC-' + record.id.slice(0, 8).toUpperCase();
  const label = type === 'orders' ? 'طلب شراء / Purchase request' : type === 'quotes' ? 'طلب عرض سعر / Quote request' : 'رسالة تواصل / Contact message';
  const acknowledgement = `مرحبًا ${record.name}\n\nتم استلام ${label}.\nالمرجع: ${reference}\nسيراجع فريق المبيعات الطلب ويتواصل معك. هذا إشعار استلام، وليس تأكيد دفع أو قبول عرض.\n\nHello ${record.name},\nWe received your request. Reference: ${reference}. Our sales team will review it and follow up. This is an acknowledgement, not a payment or quotation acceptance.\n\nSafe Places — المناطق الآمنة`;
  const result = [
    eventStatement(env, {type, requestId: record.id, kind: 'created', actorLabel: 'العميل / Customer', visibility: 'customer', toStatus: 'new', key: `created:${type}:${record.id}`}),
    notificationStatement(env, {type, requestId: record.id, kind: 'customer_confirmation', recipient: record.email, subject: `Safe Places — ${reference}`, body: acknowledgement, key: `ack:${type}:${record.id}`})
  ];
  const recipient = envText(env, 'NOTIFICATION_ADMIN_EMAIL');
  result.push(notificationStatement(env, {type, requestId: record.id, kind: 'staff_notification', recipient,
    subject: `Safe Places — ${label} — ${reference}`,
    body: `وصل طلب جديد إلى لوحة إدارة المناطق الآمنة.\nالمرجع: ${reference}\n\nA new request is available in the Safe Places administration console. Reference: ${reference}. Sign in to review the details.`, key: `staff:${type}:${record.id}`}));
  return result;
}

type OutboxRow = {id: string; request_type: RequestType; request_id: string; kind: string; recipient: string; sender: string; subject: string; body: string; attempts: number; created_at: string; idempotency_key: string};

/**
 * Resend retains idempotency keys for 24 hours. Retry only within 23 hours,
 * with an atomic database claim, so an ambiguous timeout cannot create a later duplicate.
 * "sent" means provider acceptance. We never claim mailbox delivery without a webhook.
 */
export async function processNotificationOutbox(env: OperationsBindings, fetcher: typeof fetch = fetch, limit = 8) {
  const config = notificationConfig(env);
  if (!config) return {processed: 0, accepted: 0, enabled: false};
  const due = timestamp(), cutoff = new Date(Date.now() - 23 * 3600000).toISOString();
  await env.DB.prepare("UPDATE notification_outbox SET status='failed',last_error='DELIVERY_UNCERTAIN_REVIEW_REQUIRED',lock_until=NULL,updated_at=? WHERE created_at<? AND status IN ('queued','processing')").bind(due, cutoff).run();
  await env.DB.prepare("UPDATE notification_outbox SET status='failed',last_error='DELIVERY_UNCERTAIN_REVIEW_REQUIRED',lock_until=NULL,updated_at=? WHERE status='processing' AND attempts>=5 AND lock_until<?").bind(due, due).run();
  const candidates = await env.DB.prepare("SELECT id FROM notification_outbox WHERE created_at>=? AND attempts<5 AND ((status='queued' AND next_attempt_at<=?) OR (status='processing' AND lock_until<?)) ORDER BY created_at LIMIT ?").bind(cutoff, due, due, Math.max(1, Math.min(20, limit))).all<{id: string}>();
  let processed = 0, accepted = 0;
  for (const candidate of candidates.results) {
    const lock = new Date(Date.now() + 120000).toISOString();
    const job = await env.DB.prepare("UPDATE notification_outbox SET status='processing',attempts=attempts+1,sender=coalesce(sender,?),lock_until=?,updated_at=? WHERE id=? AND attempts<5 AND ((status='queued' AND next_attempt_at<=?) OR (status='processing' AND lock_until<?)) RETURNING *").bind(config.from, lock, due, candidate.id, due, due).first<OutboxRow>();
    if (!job) continue;
    processed++;
    let acceptedId: string | null = null, failure = 'EMAIL_DELIVERY_FAILED', retry = false;
    try {
      const response = await fetcher('https://api.resend.com/emails', {method: 'POST', headers: {
        Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json', 'Idempotency-Key': job.idempotency_key
      }, body: JSON.stringify({
        from: `Safe Places <${job.sender}>`, to: [job.recipient], subject: job.subject, text: job.body,
        ...(config.replyTo ? {reply_to: config.replyTo} : {})
      }), signal: AbortSignal.timeout(10000)});
      if (response.ok) {
        const result = await response.json() as {id?: unknown};
        if (typeof result.id === 'string' && result.id.length < 200) acceptedId = result.id;
        else {failure = 'EMAIL_RESPONSE_UNCERTAIN'; retry = true;}
      } else {
        retry = response.status === 429 || response.status >= 500 || response.status === 409;
        failure = response.status === 401 || response.status === 403 ? 'EMAIL_PROVIDER_CONFIGURATION' : `EMAIL_PROVIDER_${response.status}`;
        await response.body?.cancel();
      }
    } catch {
      failure = 'EMAIL_RESPONSE_UNCERTAIN';
      retry = true;
    }
    const time = timestamp();
    if (acceptedId) {
      // Do not send again if bookkeeping fails: the processing lease and provider key
      // permit a safe retry using the exact same saved payload.
      const statements = [env.DB.prepare("UPDATE notification_outbox SET status='sent',provider_id=?,sent_at=?,updated_at=?,lock_until=NULL,last_error=NULL WHERE id=? AND status='processing' AND lock_until=?").bind(acceptedId, time, time, job.id, lock)];
      if (job.kind === 'customer_reply') statements.push(env.DB.prepare("INSERT INTO request_events (id,request_type,request_id,actor_label,kind,visibility,body,idempotency_key,created_at) SELECT ?,request_type,request_id,'Safe Places','reply','customer',body,?,? FROM notification_outbox WHERE id=? AND status='sent' AND changes()=1")
        .bind(crypto.randomUUID(), `reply:${job.id}`, time, job.id));
      const results = await env.DB.batch(statements);
      if (results[0].meta.changes) accepted++;
    } else {
      const again = retry && job.attempts < 5;
      const next = new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.max(0, job.attempts - 1))).toISOString();
      await env.DB.prepare('UPDATE notification_outbox SET status=?,next_attempt_at=?,last_error=?,lock_until=NULL,updated_at=? WHERE id=? AND lock_until=?').bind(again ? 'queued' : 'failed', next, failure, time, job.id, lock).run();
    }
  }
  return {processed, accepted, enabled: true};
}

/** No customer data is deleted here; only expired throttles and abandoned uploads. */
export async function runOperationalMaintenance(env: OperationsBindings) {
  const outcome = await processNotificationOutbox(env);
  const current = Date.now(), cutoff = new Date(current - 48 * 3600000).toISOString();
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires<?').bind(current - 86400000).run();
  if (env.BUCKET) {
    const rows = await env.DB.prepare('SELECT id,object_key FROM files WHERE parent_id IS NULL AND is_public=0 AND created_at<? LIMIT 30').bind(cutoff).all<{id: string; object_key: string}>();
    for (const file of rows.results) {
      // Expired unattached files can no longer be attached by request handlers.
      await env.BUCKET.delete(file.object_key);
      await env.DB.prepare('DELETE FROM files WHERE id=? AND parent_id IS NULL AND is_public=0 AND created_at<?').bind(file.id, cutoff).run();
    }
  }
  await env.DB.prepare("INSERT INTO settings (key,value) VALUES ('operations-last-maintenance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(timestamp())).run();
  return outcome;
}

import {z} from 'zod';
import {canAdmin} from './admin-permissions';
import {readyAuthConfig,enabledProviders} from './auth-settings';
import type {AdminIdentity} from './access';
import {eventStatement, notificationConfig} from './notifications';
import {limitedBody} from './upload-policy';
import {MAX_UPLOAD_BYTES, UPLOAD_TYPES, OperationError, requestTypes, type OperationsBindings, type RequestType, type RequestRecord} from './operations-types';

const now = () => new Date().toISOString();
const keySchema = z.object({type: z.enum(requestTypes), id: z.string().min(1).max(100)});
const camel = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
const json = (value: unknown) => Response.json(value, {headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});
async function body(request: Request) {
  return JSON.parse(new TextDecoder().decode(await limitedBody(request, 24000)));
}
export async function requestRecord(env: OperationsBindings, type: RequestType, id: string) {
  if (!requestTypes.includes(type)) throw new OperationError('NOT_FOUND', 404);
  const row = await env.DB.prepare(`SELECT * FROM ${type} WHERE id=?`).bind(id).first<RequestRecord>();
  if (!row) throw new OperationError('NOT_FOUND', 404);
  return row;
}
function requireRequest(admin: AdminIdentity, type: RequestType) {
  if (!canAdmin(admin, type)) throw new OperationError('FORBIDDEN', 403);
}

async function requestDetail(env: OperationsBindings, type: RequestType, id: string) {
  const record = await requestRecord(env, type, id);
  const [files, events, draft, notifications] = await Promise.all([
    env.DB.prepare('SELECT id,name,mime,size,created_at FROM files WHERE parent_id=? AND is_public=0 ORDER BY created_at').bind(id).all(),
    env.DB.prepare('SELECT id,actor_label,kind,visibility,body,from_status,to_status,created_at FROM request_events WHERE request_type=? AND request_id=? ORDER BY created_at DESC,id DESC LIMIT 200').bind(type, id).all(),
    env.DB.prepare('SELECT id,body,updated_at FROM request_drafts WHERE request_type=? AND request_id=?').bind(type, id).first(),
    env.DB.prepare('SELECT id,kind,recipient,status,attempts,last_error,created_at,sent_at FROM notification_outbox WHERE request_type=? AND request_id=? ORDER BY created_at DESC LIMIT 100').bind(type, id).all()
  ]);
  const {idempotency_key: _key, ...visibleRecord} = record;
  return {record: camel(visibleRecord), files: files.results.map(file => ({...camel(file), url: '/api/media/' + file.id})),
    events: events.results.reverse().map(camel), draft: draft ? camel(draft) : null, notifications: notifications.results.map(camel),
    mailEnabled: !!notificationConfig(env), attachments: {available: !!env.BUCKET, maxBytes: MAX_UPLOAD_BYTES, allowedTypes: UPLOAD_TYPES}};
}

/** Account responses only expose the authenticated customer's own published timeline. */
export async function customerRequestDetail(env: OperationsBindings, type: RequestType, id: string, userId: string) {
  if (type === 'contacts') throw new OperationError('NOT_FOUND', 404);
  const record = await requestRecord(env, type, id);
  if (record.user_id !== userId) throw new OperationError('NOT_FOUND', 404);
  const [events, files] = await Promise.all([
    env.DB.prepare("SELECT id,kind,body,to_status,created_at FROM request_events WHERE request_type=? AND request_id=? AND visibility='customer' ORDER BY created_at DESC,id DESC LIMIT 200").bind(type, id).all(),
    env.DB.prepare('SELECT id,name,mime,size FROM files WHERE parent_id=? AND owner_id=? AND is_public=0').bind(id, userId).all()
  ]);
  return {events: events.results.reverse().map(camel), files: files.results.map(file => ({...file, url: '/api/media/' + file.id}))};
}

export async function getOperationalReadiness(env: OperationsBindings) {
  const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name: string}>();
  const names = new Set(tables.results.map(row => row.name));
  const schemaReady = ['request_events', 'request_drafts', 'notification_outbox', 'admin_members', 'auth_user', 'auth_session'].every(name => names.has(name));
  const configured = (key: string) => typeof env[key] === 'string' && String(env[key]).trim().length > 0;
  const authReady = !!readyAuthConfig(env) && enabledProviders(env).includes('google');
  const ownerConfigured = configured('STANDALONE_ADMIN_USER_ID') && configured('STANDALONE_ADMIN_EMAIL');
  const owner = ownerConfigured && names.has('auth_user') ? await env.DB.prepare('SELECT id FROM auth_user WHERE id=? AND lower(email)=? AND email_verified=1').bind(String(env.STANDALONE_ADMIN_USER_ID), String(env.STANDALONE_ADMIN_EMAIL).trim().toLowerCase()).first() : null;
  const maintenance = await env.DB.prepare("SELECT value FROM settings WHERE key='operations-last-maintenance'").first<{value: string}>();
  const mail = !!notificationConfig(env), attachments = !!env.BUCKET;
  const preview = env.SITE_INDEXABLE !== 'true' && env.SITE_DEMO_PRICES === 'true';
  return {mailEnabled: mail, attachmentsAvailable: attachments, checks: [
    {id: 'database', labelAr: 'قاعدة البيانات والمتابعة', labelEn: 'Database and request tracking', status: schemaReady ? 'ready' : 'blocked', detailAr: schemaReady ? 'جداول الطلبات والملاحظات والمسودات والتنبيهات متاحة.' : 'يلزم تطبيق ترحيل جداول التشغيل.', detailEn: schemaReady ? 'Request, note, draft and notification tables are available.' : 'The operations database migration is required.'},
    {id: 'google', labelAr: 'تسجيل الدخول عبر Google', labelEn: 'Google sign-in', status: authReady ? 'ready' : 'blocked', detailAr: authReady ? 'إعدادات الربط موجودة. يعتمد اختبار الدخول الفعلي على حساب Google المعتمد.' : 'يلزم إعداد OAuth ومفاتيح الجلسات في الاستضافة.', detailEn: authReady ? 'Configuration is present. Live sign-in must be verified with the approved Google account.' : 'Configure OAuth credentials and session secrets in hosting.'},
    {id: 'owner', labelAr: 'هوية المالك', labelEn: 'Owner identity', status: owner ? 'ready' : 'blocked', detailAr: owner ? 'الهوية المثبتة تطابق حسابًا ذا بريد موثق.' : 'سجّل الدخول بالحساب المعتمد ثم ثبّت معرّفه وبريده في إعدادات الاستضافة.', detailEn: owner ? 'The pinned identity matches a verified account.' : 'Sign in with the designated owner account, then pin its ID and verified email in hosting.'},
    {id: 'attachments', labelAr: 'المرفقات الخاصة', labelEn: 'Private attachments', status: attachments ? 'ready' : 'blocked', detailAr: attachments ? 'التخزين مرتبط وتُفحص صلاحية كل طلب تحميل.' : 'فعّل R2 واربط الحاوية الخاصة قبل رفع الملفات.', detailEn: attachments ? 'Storage is bound and each download requires an access check.' : 'Enable R2 and bind the private bucket before accepting uploads.'},
    {id: 'mail', labelAr: 'إرسال البريد', labelEn: 'Outbound email', status: mail ? 'ready' : 'blocked', detailAr: mail ? 'إرسال البريد مفعّل. القبول من المزود لا يثبت الوصول إلى صندوق الوارد.' : 'التنبيهات محفوظة بحالة متوقفة. يلزم مزود بريد ومرسل معتمد وتفعيل الإرسال.', detailEn: mail ? 'Outbound email is enabled. Provider acceptance does not prove inbox delivery.' : 'Notifications are saved as blocked. Configure the provider and verified sender, then enable sending.'},
    {id: 'mail-recipient', labelAr: 'مستلم تنبيهات الإدارة', labelEn: 'Administrative notification recipient', status: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.NOTIFICATION_ADMIN_EMAIL || '')) ? 'ready' : 'pending', detailAr: 'يُحدد بريد تنبيهات الإدارة في إعدادات الاستضافة.', detailEn: 'Set the administrative notification recipient in hosting configuration.'},
    {id: 'maintenance', labelAr: 'معالجة التنبيهات والصيانة', labelEn: 'Notification processing and maintenance', status: maintenance ? 'ready' : 'pending', detailAr: maintenance ? 'سُجل تشغيل مهمة الصيانة. تُعالج التنبيهات المفعّلة تلقائيًا.' : 'تنتظر أول تشغيل للمهمة المجدولة بعد النشر.', detailEn: maintenance ? 'A scheduled maintenance run was recorded. Enabled notifications are processed automatically.' : 'Waiting for the first scheduled run after deployment.'},
    {id: 'preview', labelAr: 'إعدادات المعاينة', labelEn: 'Preview settings', status: preview ? 'ready' : 'pending', detailAr: preview ? 'الفهرسة معطلة والأسعار التجريبية مخصصة للمراجعة.' : 'راجع اعتماد البيئة قبل الإطلاق.', detailEn: preview ? 'Indexing is disabled and illustrative prices are for review.' : 'Review the environment configuration before launch.'},
    {id: 'recovery', labelAr: 'النسخ والاستعادة', labelEn: 'Backup and recovery', status: 'pending', detailAr: 'دليل الاستعادة جاهز؛ تُجرّب الاستعادة على قاعدة منفصلة قبل الإطلاق التجاري.', detailEn: 'The recovery runbook is ready. Rehearse restoration on a separate database before commercial launch.'}
  ]};
}

export async function handleAdminOperations(request: Request, path: string, admin: AdminIdentity, env: OperationsBindings): Promise<Response | null> {
  if (path === 'admin/readiness' && request.method === 'GET') {
    if (!canAdmin(admin, 'settings')) throw new OperationError('FORBIDDEN', 403);
    return json(await getOperationalReadiness(env));
  }
  const detail = path.match(/^admin\/requests\/(orders|quotes|contacts)\/([^/]+)$/);
  if (detail && request.method === 'GET') {
    const type = detail[1] as RequestType; requireRequest(admin, type);
    return json(await requestDetail(env, type, detail[2]));
  }
  if (!['admin/request-note', 'admin/request-draft', 'admin/request-send', 'admin/notifications/retry', 'admin/notifications/cancel'].includes(path)) return null;
  if (request.method !== 'POST') throw new OperationError('NOT_FOUND', 404);
  const input = await body(request);
  if (path.startsWith('admin/notifications/')) {
    const {id} = z.object({id: z.string().uuid()}).parse(input);
    const job = await env.DB.prepare('SELECT * FROM notification_outbox WHERE id=?').bind(id).first<{request_type: RequestType; request_id: string; status: string; attempts: number; created_at: string; kind: string; recipient: string}>();
    if (!job) throw new OperationError('NOT_FOUND', 404); requireRequest(admin, job.request_type);
    let mutation: D1PreparedStatement;
    if (path.endsWith('/cancel')) {
      if (!['blocked','queued'].includes(job.status) || job.attempts !== 0) throw new OperationError('SEND_PENDING', 409);
      mutation = env.DB.prepare("UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE id=? AND status IN ('blocked','queued') AND attempts=0").bind(now(), id);
    } else {
      if (!notificationConfig(env)) throw new OperationError('EMAIL_NOT_CONFIGURED', 503);
      // Do not retry an uncertain old send outside the provider's idempotency window.
      if (job.attempts >= 5 || (job.attempts > 0 && Date.now() - Date.parse(job.created_at) >= 23 * 3600000)) throw new OperationError('DELIVERY_UNCERTAIN_REVIEW_REQUIRED', 409);
      const recipient = job.kind === 'staff_notification' && job.attempts === 0 ? String(env.NOTIFICATION_ADMIN_EMAIL || '').trim() : job.recipient;
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) throw new OperationError('EMAIL_NOT_CONFIGURED', 503);
      const time = now();
      if (!['blocked','failed'].includes(job.status)) throw new OperationError('SEND_PENDING', 409);
      mutation = env.DB.prepare("UPDATE notification_outbox SET status='queued',recipient=?,last_error=NULL,next_attempt_at=?,created_at=CASE WHEN attempts=0 THEN ? ELSE created_at END,updated_at=? WHERE id=? AND status IN ('blocked','failed') AND attempts=? AND created_at=?").bind(recipient, time, time, time, id, job.attempts, job.created_at);
    }
    const event = env.DB.prepare("INSERT INTO request_events (id,request_type,request_id,actor_id,actor_label,kind,visibility,idempotency_key,created_at) SELECT ?,request_type,CASE WHEN changes()=1 THEN request_id ELSE NULL END,?,?,?,'internal',?,? FROM notification_outbox WHERE id=?")
      .bind(crypto.randomUUID(), admin.userId, admin.displayName, path.endsWith('/cancel') ? 'notification_cancelled' : 'notification_retried', crypto.randomUUID(), now(), id);
    try {await env.DB.batch([mutation, event]);}
    catch (error) {if (error instanceof Error && /request_events.request_id|notification_outbox.request_type|notification_outbox_active_reply_unique/.test(error.message)) throw new OperationError('SEND_PENDING', 409); throw error;}
    return json({ok: true});
  }
  const {type, id} = keySchema.parse(input); requireRequest(admin, type);
  const record = await requestRecord(env, type, id);
  if (path === 'admin/request-note') {
    const value = keySchema.extend({body: z.string().trim().min(1).max(8000), key: z.string().uuid()}).parse(input);
    const key = `note:${type}:${id}:${admin.userId}:${value.key}`;
    const existing = await env.DB.prepare('SELECT id,body FROM request_events WHERE idempotency_key=?').bind(key).first<{id: string; body: string}>();
    if (existing) {
      if (existing.body !== value.body) throw new OperationError('IDEMPOTENCY_CONFLICT', 409);
      return json({ok: true, id: existing.id});
    }
    try {await env.DB.batch([eventStatement(env, {type, requestId: id, kind: 'note', body: value.body, actorId: admin.userId, actorLabel: admin.displayName, key})]);}
    catch (error) {
      const repeated = await env.DB.prepare('SELECT body FROM request_events WHERE idempotency_key=?').bind(key).first<{body: string}>();
      if (!repeated) throw error;
      if (repeated.body !== value.body) throw new OperationError('IDEMPOTENCY_CONFLICT', 409);
    }
    return json({ok: true});
  }
  if (path === 'admin/request-draft') {
    const value = keySchema.extend({body: z.string().max(8000), expectedUpdatedAt: z.string().datetime().nullable()}).parse(input);
    const time = new Date(Math.max(Date.now(), value.expectedUpdatedAt ? Date.parse(value.expectedUpdatedAt) + 1 : 0)).toISOString();
    const draft = value.expectedUpdatedAt === null
      ? await env.DB.prepare('INSERT INTO request_drafts (id,request_type,request_id,body,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(request_type,request_id) DO NOTHING RETURNING id,body,updated_at').bind(crypto.randomUUID(), type, id, value.body, admin.userId, time).first()
      : await env.DB.prepare('UPDATE request_drafts SET body=?,updated_by=?,updated_at=? WHERE request_type=? AND request_id=? AND updated_at=? RETURNING id,body,updated_at').bind(value.body, admin.userId, time, type, id, value.expectedUpdatedAt).first();
    if (!draft) throw new OperationError('DRAFT_CHANGED', 409);
    return json({ok: true, draft: camel(draft)});
  }
  const value = keySchema.extend({key: z.string().uuid(), draftUpdatedAt: z.string().datetime()}).parse(input);
  if (!notificationConfig(env)) throw new OperationError('EMAIL_NOT_CONFIGURED', 503);
  const draft = await env.DB.prepare('SELECT id,body,updated_at FROM request_drafts WHERE request_type=? AND request_id=?').bind(type, id).first<{id: string; body: string; updated_at: string}>();
  if (!draft?.body.trim()) throw new OperationError('DRAFT_EMPTY', 400);
  if (draft.updated_at !== value.draftUpdatedAt) throw new OperationError('DRAFT_CHANGED', 409);
  const key = `reply:${draft.id}:${draft.updated_at}`, jobId = crypto.randomUUID(), time = now();
  const reference = record.number || 'SPC-' + id.slice(0, 8).toUpperCase();
  const existing = await env.DB.prepare('SELECT id,status FROM notification_outbox WHERE idempotency_key=?').bind(key).first();
  if (existing) return json({ok: true, ...existing});
  if ((await env.DB.prepare("SELECT id FROM notification_outbox WHERE request_type=? AND request_id=? AND kind='customer_reply' AND status IN ('queued','processing') LIMIT 1").bind(type, id).first())) throw new OperationError('SEND_PENDING', 409);
  try {await env.DB.batch([
    env.DB.prepare("INSERT INTO notification_outbox (id,request_type,request_id,kind,recipient,subject,body,status,next_attempt_at,idempotency_key,created_at,updated_at) SELECT ?,request_type,request_id,'customer_reply',?,?,body,'queued',?,?,?,? FROM request_drafts WHERE id=? AND updated_at=? ON CONFLICT(idempotency_key) DO NOTHING").bind(jobId, record.email, `Safe Places — ${reference}`, time, key, time, time, draft.id, value.draftUpdatedAt),
    env.DB.prepare("INSERT INTO request_events (id,request_type,request_id,actor_id,actor_label,kind,visibility,body,idempotency_key,created_at) SELECT ?,request_type,request_id,?,?,'reply_queued','internal',NULL,?,? FROM notification_outbox WHERE id=?").bind(crypto.randomUUID(), admin.userId, admin.displayName, `queued:${jobId}`, time, jobId)
  ]);} catch (error) {
    const repeated = await env.DB.prepare('SELECT id,status FROM notification_outbox WHERE idempotency_key=?').bind(key).first();
    if (repeated) return json({ok: true, ...repeated});
    if (error instanceof Error && /notification_outbox.request_type|notification_outbox_active_reply_unique/.test(error.message)) throw new OperationError('SEND_PENDING', 409);
    throw error;
  }
  const queued = await env.DB.prepare('SELECT id,status FROM notification_outbox WHERE idempotency_key=?').bind(key).first();
  if (!queued) throw new OperationError('DRAFT_CHANGED', 409);
  return json({ok: true, ...queued});
}

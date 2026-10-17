import nodeAssert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const startedAt = new Date();
const assertions = {passed:0, failed:0};
const scenarios = [];
let outcome = 'failed', failure = null;
const assert = new Proxy(nodeAssert, {get(target, key) {
  const method = Reflect.get(target, key);
  if (typeof method !== 'function') return method;
  return (...args) => {
    try {const result = Reflect.apply(method, target, args); assertions.passed++; return result;}
    catch (error) {assertions.failed++; throw error;}
  };
}});
const pass = name => {scenarios.push(name); console.log('PASS: ' + name);};

// All identities, records, files and delivery responses in this suite are local
// fixtures. No live database, OAuth account, mail service or storefront basket
// is used. Outbound mail is disabled in the application-under-test.
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const require = createRequire(import.meta.url);
const requireWrangler = createRequire(require.resolve('wrangler/package.json'));
const {Miniflare} = requireWrangler('miniflare');
const serverRoot = resolve('dist/server');
assert.ok(existsSync(resolve(serverRoot, 'index.js')), 'Build the application before checking admin operations');
const modulePaths = ['index.js', ...readdirSync(serverRoot, {recursive: true}).filter(path => path.endsWith('.js') && path !== 'index.js')];
let outboundCalls = 0;
const mf = new Miniflare({
  name: 'safeplaces-admin-operations-test',
  modulesRoot: serverRoot,
  modules: modulePaths.map(path => ({type: 'ESModule', path: resolve(serverRoot, path)})),
  compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'],
  d1Databases: {DB: 'operations-' + randomUUID()},
  r2Buckets: ['BUCKET'],
  bindings: {
    ADMIN_BOOTSTRAP_PRIVATE: 'false', SITE_PUBLIC: 'false', SITE_INDEXABLE: 'false',
    SITE_DEMO_PRICES: 'true', EMAIL_NOTIFICATIONS_ENABLED: 'false'
  },
  outboundService: () => {outboundCalls++; return new Response('External calls disabled in isolated operations tests', {status:503});},
  port: 0,
  host: '127.0.0.1'
});

const origin = 'https://safe-places-safety.kh-ng-gian-l-3883.chatgpt.site';
const identity = (id, email) => ({'oai-authenticated-user-id': id, 'oai-authenticated-user-email': email});
const owner = identity('operations-owner', 'owner@example.test');
const customer = identity('operations-customer', 'customer@example.test');
const unrelated = identity('operations-unrelated', 'unrelated@example.test');
let requestSequence = 0;
const clientHeaders = () => ({'CF-Connecting-IP': '192.0.2.' + (++requestSequence % 200 + 1)});
const request = (path, body, user = {}, headers = {}) => mf.dispatchFetch(origin + path, {
  redirect: 'manual',
  method: body === undefined ? 'GET' : 'POST',
  // Distinct synthetic clients keep hourly public-form throttles independent
  // from these transaction, authorization and idempotency tests.
  headers: {...clientHeaders(), ...user, ...(body === undefined ? {} : {Origin: origin, 'Content-Type': 'application/json'}), ...headers},
  ...(body === undefined ? {} : {body: JSON.stringify(body)})
});
async function expectJSON(path, body, user = {}, status = 200, error) {
  const response = await request(path, body, user);
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { assert.fail(`${path}: expected JSON, got ${response.status} ${text.slice(0,300)}`); }
  assert.equal(response.status, status, `${path}: ${JSON.stringify(value)}`);
  assert.match(response.headers.get('cache-control') || '', /no-store/, `${path}: request data must not be cached`);
  if (error) assert.equal(value.error, error, path);
  return value;
}
const detail = (type, id, user = owner) => expectJSON(`/api/admin/requests/${type}/${id}`, undefined, user);
const draftVersion = draft => draft?.updatedAt ?? draft?.updated_at;
const quoteBody = patch => ({
  name: 'Operations test customer', email: 'customer@example.test', phone: '0500000000',
  company: 'Local fixture', city: 'Al Khobar', service: 'fire-alarm',
  description: 'Please review the attached project requirements in this isolated test.',
  items: [], files: [], token: randomUUID(), key: randomUUID(), website: '', ...patch
});
async function upload(user = customer, patch = {}) {
  const form = new FormData();
  form.append('token', randomUUID());
  form.append('file', new File(['%PDF-1.4\nLocal private operations fixture\n%%EOF'], 'project-requirements.pdf', {type: 'application/pdf'}));
  for (const [key, value] of Object.entries(patch)) form.set(key, value);
  const encoded = new Request(origin + '/api/uploads', {method: 'POST', headers: {...clientHeaders(), ...user, Origin: origin}, body: form});
  const response = await mf.dispatchFetch(encoded.url, {method: 'POST', headers: Object.fromEntries(encoded.headers), body: new Uint8Array(await encoded.arrayBuffer())});
  const value = await response.json();
  assert.equal(response.status, 200, 'Private fixture upload: ' + JSON.stringify(value));
  return value;
}

try {
  const db = await mf.getD1Database('DB');
  // Repository migrations contain DDL only. Splitting on semicolons also applies
  // the older auth migrations that predate Drizzle statement-breakpoint markers.
  for (const file of readdirSync('drizzle').filter(path => path.endsWith('.sql')).sort()) {
    for (const sql of readFileSync('drizzle/' + file, 'utf8').replace(/^\s*--.*$/gm, '').split(';').filter(part => part.trim())) {
      await db.prepare(sql).run();
    }
  }
  await db.prepare("INSERT INTO settings (key,value) VALUES ('site-owner',?)").bind('operations-owner').run();
  const scalar = async (sql, ...params) => (await db.prepare(sql).bind(...params).first()).count;
  const snapshot = async () => ({
    quotes: await scalar('SELECT COUNT(*) AS count FROM quotes'),
    contacts: await scalar('SELECT COUNT(*) AS count FROM contacts'),
    events: await scalar('SELECT COUNT(*) AS count FROM request_events'),
    notifications: await scalar('SELECT COUNT(*) AS count FROM notification_outbox')
  });
  const savedQuote = key => db.prepare('SELECT * FROM quotes WHERE idempotency_key=?').bind(key).first();

  await expectJSON('/api/admin/readiness', undefined, {}, 403);
  await expectJSON('/api/admin/readiness', undefined, customer, 403);
  const readiness = await expectJSON('/api/admin/readiness', undefined, owner);
  assert.ok(readiness && typeof readiness === 'object');
  assert.doesNotMatch(JSON.stringify(readiness), /"(?:secret|clientSecret|apiKey|token)"\s*:/i, 'Readiness must report configuration presence, never credential values');

  const contactBody = {name: 'Contact fixture', email: 'contact@example.test', phone: '0500000000', message: 'Please contact our project coordinator about requirements.', website: '', key: randomUUID()};
  await expectJSON('/api/contact', contactBody);
  await expectJSON('/api/contact', contactBody);
  assert.equal(await scalar('SELECT COUNT(*) AS count FROM contacts WHERE idempotency_key=?', contactBody.key), 1, 'A repeated contact submission must retain one record');
  const contact = await db.prepare('SELECT * FROM contacts WHERE idempotency_key=?').bind(contactBody.key).first();
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM request_events WHERE request_type='contacts' AND request_id=? AND kind='created'", contact.id), 1);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM notification_outbox WHERE request_type='contacts' AND request_id=?", contact.id), 2);
  await expectJSON('/api/contact', {...contactBody, message: 'A different message may not overwrite the original request.'}, {}, 409);
  assert.equal((await db.prepare('SELECT message FROM contacts WHERE id=?').bind(contact.id).first()).message, contactBody.message);
  const contactRace = {...contactBody, key: randomUUID()};
  const repeatedContact = await Promise.all([request('/api/contact', contactRace), request('/api/contact', contactRace)]);
  assert.deepEqual(repeatedContact.map(response => response.status), [200,200], 'Concurrent equivalent contact retries should both receive the existing success');
  await Promise.all(repeatedContact.map(response => response.arrayBuffer()));
  assert.equal(await scalar('SELECT COUNT(*) AS count FROM contacts WHERE idempotency_key=?', contactRace.key), 1);

  const attachment = await upload();
  const quoteInput = quoteBody({files: [attachment.id]});
  await expectJSON('/api/quotes', quoteInput, customer);
  await expectJSON('/api/quotes', quoteInput, customer);
  const quote = await savedQuote(quoteInput.key);
  assert.ok(quote, 'Quotation must persist before the success response');
  assert.equal(await scalar('SELECT COUNT(*) AS count FROM quotes WHERE idempotency_key=?', quoteInput.key), 1);
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM request_events WHERE request_type='quotes' AND request_id=? AND kind='created'", quote.id), 1);
  const storedFile = await db.prepare('SELECT parent_id,is_public FROM files WHERE id=?').bind(attachment.id).first();
  assert.deepEqual(storedFile, {parent_id: quote.id, is_public: 0});
  for (const user of [{}, unrelated]) {
    const response = await request(attachment.url, undefined, user);
    assert.equal(response.status, 403, 'A request attachment must not become public or cross-account readable');
    await response.arrayBuffer();
  }
  for (const user of [customer, owner]) {
    const response = await request(attachment.url, undefined, user);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /private.*no-store/);
    assert.match(response.headers.get('content-disposition') || '', /^attachment/);
    await response.arrayBuffer();
  }
  await expectJSON('/api/quotes', quoteInput, unrelated, 409, 'IDEMPOTENCY_CONFLICT');
  const beforeInvalid = await snapshot();
  const unbound = await upload();
  await expectJSON('/api/quotes', quoteBody({files: [unbound.id, randomUUID()]}), customer, 400);
  assert.deepEqual(await snapshot(), beforeInvalid, 'Missing attachment rejects the whole request, timeline and notification transaction');
  assert.equal((await db.prepare('SELECT parent_id FROM files WHERE id=?').bind(unbound.id).first()).parent_id, null);
  await expectJSON('/api/quotes', quoteBody({files: [attachment.id]}), customer, 400);
  assert.deepEqual(await snapshot(), beforeInvalid, 'An attachment already linked to a request cannot be moved');

  // Force a failure after request processing begins, rather than just checking
  // validation performed before a write. The D1 transaction must retain neither
  // the request nor a claimed attachment nor its acknowledgement jobs.
  await db.prepare("CREATE TRIGGER operations_test_fail_created BEFORE INSERT ON request_events WHEN NEW.request_type='quotes' AND NEW.kind='created' BEGIN SELECT RAISE(ABORT,'operations test injected event failure'); END").run();
  try {
    await expectJSON('/api/quotes', quoteBody({files: [unbound.id]}), customer, 500);
  } finally {
    await db.prepare('DROP TRIGGER operations_test_fail_created').run();
  }
  assert.deepEqual(await snapshot(), beforeInvalid, 'A failed timeline insert must roll back the entire incoming request');
  assert.equal((await db.prepare('SELECT parent_id FROM files WHERE id=?').bind(unbound.id).first()).parent_id, null);

  const racedFile = await upload();
  const competing = [quoteBody({files:[racedFile.id]}), quoteBody({files:[racedFile.id]})];
  const competingResponses = await Promise.all(competing.map(body => request('/api/quotes', body, customer)));
  const competingStatuses = competingResponses.map(response => response.status);
  await Promise.all(competingResponses.map(response => response.arrayBuffer()));
  assert.equal(competingStatuses.filter(status => status === 200).length, 1, 'Exactly one concurrent request may claim the same attachment');
  assert.ok(competingStatuses.some(status => status === 400 || status === 409), 'The losing attachment claim must receive a controlled conflict');
  const winners = (await db.prepare('SELECT id FROM quotes WHERE idempotency_key IN (?,?)').bind(...competing.map(body => body.key)).all()).results;
  assert.equal(winners.length, 1, 'A lost attachment race must not leave a second request');
  assert.equal((await db.prepare('SELECT parent_id FROM files WHERE id=?').bind(racedFile.id).first()).parent_id, winners[0].id);
  pass('Contact/quote idempotency, private attachments, invalid-attachment rollback and concurrent attachment claims');

  // An order fixture exercises administrative follow-up only. It does not run a
  // checkout, calculate a basket, add products, or activate payment processing.
  const orderId = randomUUID();
  await db.prepare('INSERT INTO orders (id,number,user_id,name,email,phone,items,subtotal,vat,total,created_at,idempotency_key,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(orderId, 'SPO-OPERATIONS-TEST', 'operations-customer', 'Order fixture', 'customer@example.test', '0500000000', '[]', 0, 0, 0, new Date().toISOString(), randomUUID(), 'LEGACY_INTERNAL_ORDER_NOTE').run();
  const records = [{type:'contacts', id:contact.id}, {type:'quotes', id:quote.id}, {type:'orders', id:orderId}];
  const privateMarkers = ['LEGACY_INTERNAL_ORDER_NOTE'];
  for (const record of records) {
    const path = `/api/admin/requests/${record.type}/${record.id}`;
    await expectJSON(path, undefined, {}, 403);
    await expectJSON(path, undefined, customer, 403);
    await expectJSON(path, undefined, unrelated, 403);
    const initial = await detail(record.type, record.id);
    assert.equal(initial.record.id, record.id);
    for (const key of ['events','files','notifications']) assert.ok(Array.isArray(initial[key]), 'Request details include ' + key);
    assert.equal(initial.mailEnabled, false);
    assert.ok(Object.hasOwn(initial, 'draft') && Object.hasOwn(initial, 'attachments'));
    const note = {...record, body:'INTERNAL_ONLY_' + record.type + '_' + randomUUID(), key:randomUUID()};
    privateMarkers.push(note.body);
    await expectJSON('/api/admin/request-note', note, customer, 403);
    await expectJSON('/api/admin/request-note', note, owner);
    await expectJSON('/api/admin/request-note', note, owner);
    await expectJSON('/api/admin/request-note', {...note, body:'This reused key must never replace an internal note.'}, owner, 409);
    const noteEvents = (await detail(record.type, record.id)).events.filter(event => event.body === note.body);
    assert.equal(noteEvents.length, 1, 'An internal note is immutable and idempotent');
    assert.equal(noteEvents[0].visibility, 'internal');
    const draftText = 'UNSENT_PRIVATE_DRAFT_' + record.type + '_' + randomUUID();
    privateMarkers.push(draftText);
    const draft = {...record, body:draftText, expectedUpdatedAt:null};
    await expectJSON('/api/admin/request-draft', draft, owner);
    const firstDraft = (await detail(record.type, record.id)).draft;
    assert.equal(firstDraft.body, draftText);
    assert.equal(typeof draftVersion(firstDraft), 'string');
    await expectJSON('/api/admin/request-draft', {...draft, body:'A stale create cannot overwrite this draft.'}, owner, 409);
    const edits = ['First concurrent edit','Second concurrent edit'].map(body => ({...draft, body, expectedUpdatedAt:draftVersion(firstDraft)}));
    const responses = await Promise.all(edits.map(body => request('/api/admin/request-draft', body, owner)));
    assert.deepEqual(responses.map(response => response.status).sort(), [200,409], 'Exactly one editor may replace the same saved draft version');
    await Promise.all(responses.map(response => response.arrayBuffer()));
    const latestDraft = (await detail(record.type, record.id)).draft;
    assert.ok(edits.some(edit => edit.body === latestDraft.body));
    assert.notEqual(draftVersion(latestDraft), draftVersion(firstDraft), 'Every accepted draft change must advance its concurrency version');
    privateMarkers.push(latestDraft.body);
    const beforeSend = await scalar('SELECT COUNT(*) AS count FROM notification_outbox');
    await expectJSON('/api/admin/request-send', {...record, key:randomUUID(), draftUpdatedAt:draftVersion(latestDraft)}, owner, 503, 'EMAIL_NOT_CONFIGURED');
    assert.equal(await scalar('SELECT COUNT(*) AS count FROM notification_outbox'), beforeSend, 'A disabled manual send must not claim it was queued or delivered');
    assert.equal((await detail(record.type, record.id)).draft.body, latestDraft.body, 'A failed send preserves the reviewable draft');
  }

  for (const [path, body] of [
    ['/api/admin/request-note', {type:'quotes',id:quote.id,body:'A forged-origin note must fail.',key:randomUUID()}],
    ['/api/admin/request-draft', {type:'quotes',id:quote.id,body:'A forged-origin draft must fail.',expectedUpdatedAt:null}],
    ['/api/admin/status', {type:'quotes',id:quote.id,status:'review'}]
  ]) {
    const response = await request(path, body, owner, {Origin:'https://untrusted.example'});
    assert.equal(response.status, 403, path + ' rejects cross-site mutations');
    assert.equal((await response.json()).error, 'INVALID_ORIGIN');
  }
  const unknown = randomUUID();
  for (const type of ['orders','quotes','contacts']) {
    await expectJSON(`/api/admin/requests/${type}/${unknown}`, undefined, owner, 404);
    await expectJSON('/api/admin/request-note', {type,id:unknown,body:'There is no request for this note.',key:randomUUID()}, owner, 404);
    await expectJSON('/api/admin/status', {type,id:unknown,status:type === 'contacts' ? 'reviewed' : type === 'quotes' ? 'review' : 'confirmed'}, owner, 404);
  }
  await expectJSON('/api/admin/requests/unrecognized/' + quote.id, undefined, owner, 404);
  pass('Owner-only request APIs, immutable notes, optimistic draft concurrency, disabled sending, CSRF and missing-record responses');

  const proposal = await upload(owner, {purpose:'admin'});
  const beforeStatus = await detail('quotes', quote.id);
  const oldEventCount = beforeStatus.events.length;
  // The audit insert is last, after the status, event and attachment writes.
  // Failure here proves those earlier changes are rolled back together.
  await db.prepare(`CREATE TRIGGER operations_test_fail_status BEFORE INSERT ON activity WHEN NEW.entity_id='${quote.id}' AND NEW.action='quotes:update' BEGIN SELECT RAISE(ABORT,'operations test injected audit failure'); END`).run();
  try {
    await expectJSON('/api/admin/status', {type:'quotes',id:quote.id,status:'review',expectedStatus:beforeStatus.record.status,file:proposal.url}, owner, 500);
  } finally {
    await db.prepare('DROP TRIGGER operations_test_fail_status').run();
  }
  assert.equal((await detail('quotes', quote.id)).record.status, beforeStatus.record.status, 'A failed audit write must roll back the status');
  assert.equal((await detail('quotes', quote.id)).events.length, oldEventCount);
  assert.equal((await db.prepare('SELECT parent_id FROM files WHERE id=?').bind(proposal.id).first()).parent_id, null, 'A failed administrative update cannot leave a file linked');
  const legacyNote = 'LEGACY_INTERNAL_QUOTE_NOTE_' + randomUUID();
  privateMarkers.push(legacyNote);
  await expectJSON('/api/admin/status', {type:'quotes',id:quote.id,status:'review',expectedStatus:beforeStatus.record.status,file:proposal.url,notes:legacyNote}, owner);
  const updated = await detail('quotes', quote.id);
  assert.equal(updated.record.status, 'review');
  assert.ok(updated.events.some(event => (event.to_status ?? event.toStatus) === 'review'), 'The same transaction must leave a status event');
  for (const [user, status] of [[{},403],[unrelated,403],[customer,200],[owner,200]]) {
    const response = await request(proposal.url, undefined, user);
    assert.equal(response.status, status, 'A linked proposal is available only to its customer and authorized administration');
    await response.arrayBuffer();
  }
  await expectJSON('/api/admin/status', {type:'quotes',id:quote.id,status:'closed',expectedStatus:beforeStatus.record.status}, owner, 409);
  const proposalState = await db.prepare('SELECT parent_id,owner_id FROM files WHERE id=?').bind(proposal.id).first();
  const untouchedTarget = winners[0].id;
  const targetBefore = await detail('quotes', untouchedTarget);
  await expectJSON('/api/admin/status', {type:'quotes',id:untouchedTarget,status:'quoted',file:proposal.url}, owner, 400);
  assert.deepEqual(await db.prepare('SELECT parent_id,owner_id FROM files WHERE id=?').bind(proposal.id).first(), proposalState, 'An admin cannot reassign an attachment from a different request');
  assert.equal((await detail('quotes', untouchedTarget)).record.status, targetBefore.record.status);

  const customerAccount = await expectJSON('/api/account', undefined, customer);
  assert.ok(customerAccount.quotes.some(record => record.id === quote.id));
  assert.ok(customerAccount.orders.some(record => record.id === orderId));
  const serializedAccount = JSON.stringify(customerAccount);
  for (const marker of privateMarkers) assert.ok(!serializedAccount.includes(marker), 'Customer API must never expose an internal note or unsent draft: ' + marker);
  assert.doesNotMatch(serializedAccount, /"(?:notes|draft|notifications|idempotencyKey|idempotency_key|objectKey|object_key|last_error|lastError)"\s*:/, 'Customer records must omit internal storage and delivery metadata');
  const otherAccount = await expectJSON('/api/account', undefined, unrelated);
  assert.equal(otherAccount.quotes.length, 0);
  assert.equal(otherAccount.orders.length, 0);
  const publicTimeline = await expectJSON('/api/account/requests/quotes/' + quote.id, undefined, customer);
  for (const marker of privateMarkers) assert.ok(!JSON.stringify(publicTimeline).includes(marker), 'Customer timeline excludes internal and unsent text');
  await expectJSON('/api/account/requests/quotes/' + quote.id, undefined, unrelated, 404);
  const blockedMail = (await db.prepare("SELECT status,attempts,last_error FROM notification_outbox WHERE kind IN ('customer_confirmation','staff_notification')").all()).results;
  assert.ok(blockedMail.length >= 4);
  for (const mail of blockedMail) assert.deepEqual(mail, {status:'blocked',attempts:0,last_error:'EMAIL_NOT_CONFIGURED'});
  const cancellable = await db.prepare("SELECT id FROM notification_outbox WHERE request_id=? AND kind='customer_confirmation'").bind(quote.id).first();
  await expectJSON('/api/admin/notifications/cancel', {id:cancellable.id}, customer, 403);
  await expectJSON('/api/admin/notifications/retry', {id:cancellable.id}, owner, 503, 'EMAIL_NOT_CONFIGURED');
  const cancelEvents = await scalar('SELECT COUNT(*) AS count FROM request_events WHERE request_id=?', quote.id);
  await db.prepare("CREATE TRIGGER operations_test_fail_cancel BEFORE INSERT ON request_events WHEN NEW.kind='notification_cancelled' BEGIN SELECT RAISE(ABORT,'operations test injected cancellation failure'); END").run();
  try {await expectJSON('/api/admin/notifications/cancel', {id:cancellable.id}, owner, 500);}
  finally {await db.prepare('DROP TRIGGER operations_test_fail_cancel').run();}
  assert.equal((await db.prepare('SELECT status FROM notification_outbox WHERE id=?').bind(cancellable.id).first()).status, 'blocked', 'A failed cancellation event must roll back the outbox change');
  assert.equal(await scalar('SELECT COUNT(*) AS count FROM request_events WHERE request_id=?', quote.id), cancelEvents);
  await expectJSON('/api/admin/notifications/cancel', {id:cancellable.id}, owner);
  assert.equal((await db.prepare('SELECT status FROM notification_outbox WHERE id=?').bind(cancellable.id).first()).status, 'cancelled');
  await expectJSON('/api/admin/notifications/cancel', {id:cancellable.id}, owner, 409);
  assert.ok((await expectJSON('/api/account/requests/quotes/' + quote.id, undefined, customer)).events.every(event => !event.kind.startsWith('notification_')), 'Operational cancellation history remains internal');
  pass('Transactional administrative status/files/events, stale-status rejection, customer isolation and honest blocked-email state');

  // Exercise the actual outbox implementation with a fake transport. These
  // tests never call fetch against an external mail provider.
  const compiled = ts.transpileModule(readFileSync('lib/notifications.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {notificationConfig, notificationStatement, processNotificationOutbox} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
  const disabledEnv = {DB:db,EMAIL_NOTIFICATIONS_ENABLED:'false'};
  assert.equal(notificationConfig(disabledEnv), null);
  let transportCalls = 0;
  const neverSend = async () => {transportCalls++; throw new Error('Disabled mail must not invoke transport');};
  assert.deepEqual(await processNotificationOutbox(disabledEnv, neverSend), {processed:0,accepted:0,enabled:false});
  assert.equal(transportCalls, 0);
  const mailEnv = {DB:db,EMAIL_NOTIFICATIONS_ENABLED:'true',RESEND_API_KEY:'local-fixture-no-real-credential',NOTIFICATION_FROM:'sender@example.test'};
  const enqueue = async patch => {
    const key = randomUUID();
    await notificationStatement(mailEnv, {type:'quotes',requestId:quote.id,kind:'customer_reply',recipient:'customer@example.test',subject:'Local fixture',body:'Customer-visible accepted reply ' + key,key,...patch}).run();
    return db.prepare('SELECT * FROM notification_outbox WHERE idempotency_key=?').bind(key).first();
  };
  const transportLog = [];
  const accept = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    transportLog.push({key:new Headers(init.headers).get('Idempotency-Key'),body:JSON.parse(init.body)});
    return Response.json({id:'fixture-provider-' + transportLog.length});
  };
  const firstMail = await enqueue({});
  assert.deepEqual(await processNotificationOutbox(mailEnv, accept), {processed:1,accepted:1,enabled:true});
  assert.equal(transportLog[0].key, firstMail.idempotency_key);
  assert.equal(transportLog[0].body.text, firstMail.body);
  const accepted = await db.prepare('SELECT status,attempts,provider_id FROM notification_outbox WHERE id=?').bind(firstMail.id).first();
  assert.deepEqual(accepted, {status:'sent',attempts:1,provider_id:'fixture-provider-1'});
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM request_events WHERE request_id=? AND visibility='customer' AND body=?", quote.id, firstMail.body), 1);
  await processNotificationOutbox(mailEnv, accept);
  assert.equal(transportLog.length, 1, 'Accepted mail must not be sent a second time');

  const retryMail = await enqueue({});
  const retryPayloads = [];
  const unavailable = async (_url, init) => {retryPayloads.push({key:new Headers(init.headers).get('Idempotency-Key'),body:init.body}); return new Response('Temporary failure', {status:503});};
  await processNotificationOutbox(mailEnv, unavailable);
  let retryRow = await db.prepare('SELECT * FROM notification_outbox WHERE id=?').bind(retryMail.id).first();
  assert.equal(retryRow.status, 'queued');
  assert.equal(retryRow.attempts, 1);
  assert.ok(Date.parse(retryRow.next_attempt_at) > Date.now());
  await processNotificationOutbox(mailEnv, unavailable);
  assert.equal(retryPayloads.length, 1, 'Retry backoff must prevent an immediate second provider call');
  await db.prepare('UPDATE notification_outbox SET next_attempt_at=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),retryMail.id).run();
  await processNotificationOutbox({...mailEnv,NOTIFICATION_FROM:'replacement-sender@example.test'}, async (_url, init) => {retryPayloads.push({key:new Headers(init.headers).get('Idempotency-Key'),body:init.body}); return Response.json({id:'fixture-provider-retry'});});
  assert.deepEqual(retryPayloads[0], retryPayloads[1], 'Retry must preserve the provider key and exact payload even if sender configuration changes');
  retryRow = await db.prepare('SELECT status,attempts FROM notification_outbox WHERE id=?').bind(retryMail.id).first();
  assert.deepEqual(retryRow, {status:'sent',attempts:2});

  const deniedMail = await enqueue({});
  await processNotificationOutbox(mailEnv, async () => new Response('Rejected', {status:403}));
  assert.deepEqual(await db.prepare('SELECT status,attempts,last_error FROM notification_outbox WHERE id=?').bind(deniedMail.id).first(), {status:'failed',attempts:1,last_error:'EMAIL_PROVIDER_CONFIGURATION'});
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM request_events WHERE body=? AND visibility='customer'", deniedMail.body), 0, 'A failed message must not appear as a delivered customer reply');

  const expiredMail = await enqueue({});
  await db.prepare('UPDATE notification_outbox SET created_at=? WHERE id=?').bind(new Date(Date.now()-24*3600000).toISOString(),expiredMail.id).run();
  const callsBeforeExpiry = transportLog.length;
  await processNotificationOutbox(mailEnv, accept);
  assert.equal(transportLog.length, callsBeforeExpiry, 'Ambiguous old delivery must not be retried beyond the safe idempotency window');
  assert.deepEqual(await db.prepare('SELECT status,last_error FROM notification_outbox WHERE id=?').bind(expiredMail.id).first(), {status:'failed',last_error:'DELIVERY_UNCERTAIN_REVIEW_REQUIRED'});

  const claimedMail = await enqueue({});
  const callsBeforeRace = transportLog.length;
  const processors = await Promise.all([processNotificationOutbox(mailEnv, accept),processNotificationOutbox(mailEnv, accept)]);
  assert.equal(processors.reduce((sum,result) => sum + result.accepted, 0), 1);
  assert.equal(transportLog.length, callsBeforeRace + 1, 'Concurrent processors must claim a job only once');
  assert.equal((await db.prepare('SELECT attempts FROM notification_outbox WHERE id=?').bind(claimedMail.id).first()).attempts, 1);

  const lostLease = await enqueue({});
  const staleProcessor = await processNotificationOutbox(mailEnv, async () => {
    await db.prepare('UPDATE notification_outbox SET lock_until=? WHERE id=?')
      .bind(new Date(Date.now()+300000).toISOString(),lostLease.id).run();
    return Response.json({id:'fixture-provider-stale-lease'});
  });
  assert.equal(staleProcessor.accepted, 0, 'A processor that lost its lease cannot finalize another processor\'s job');
  assert.equal((await db.prepare('SELECT status FROM notification_outbox WHERE id=?').bind(lostLease.id).first()).status, 'processing');
  assert.equal(await scalar("SELECT COUNT(*) AS count FROM request_events WHERE request_id=? AND visibility='customer' AND body=?", quote.id,lostLease.body), 0, 'A stale processor cannot publish a customer reply without its matching status update');
  await db.prepare("UPDATE notification_outbox SET status='failed',lock_until=NULL,last_error='TEST_LEASE_COMPLETE' WHERE id=?").bind(lostLease.id).run();

  const exhaustedLease = await enqueue({});
  await db.prepare("UPDATE notification_outbox SET status='processing',attempts=5,lock_until=? WHERE id=?")
    .bind(new Date(Date.now()-1000).toISOString(),exhaustedLease.id).run();
  const callsBeforeExhaustion = transportLog.length;
  await processNotificationOutbox(mailEnv, accept);
  assert.equal(transportLog.length, callsBeforeExhaustion, 'An exhausted lease cannot produce a sixth unapproved delivery attempt');
  const exhausted = await db.prepare('SELECT status,lock_until,last_error FROM notification_outbox WHERE id=?').bind(exhaustedLease.id).first();
  assert.equal(exhausted.status, 'failed', 'A crash during the final attempt must reach a reviewable terminal state after its lease expires');
  assert.equal(exhausted.lock_until, null);
  assert.ok(exhausted.last_error, 'An exhausted delivery needs an honest diagnostic instead of remaining stuck in processing');
  pass('Mocked notification acceptance, disabled transport, provider idempotency, retry backoff, permanent failures, expiry and concurrent/exhausted claims');
  assert.equal(outboundCalls, 0, 'The application must never call a live provider during isolated operations checks');
  nodeAssert.equal(assertions.failed, 0, 'A caught assertion in the fake transport must still fail the suite');
  outcome = 'passed';
  console.log('PASS: isolated admin operations integration suite; no live emails, customer data, products or basket tests');
} catch (error) {
  failure = error instanceof Error ? error.message.slice(0,1200) : 'Unknown integration failure';
  throw error;
} finally {
  try {await mf.dispose();} finally {
    mkdirSync('test-results', {recursive:true});
    writeFileSync('test-results/admin-operations.json', JSON.stringify({
      suite:'admin-operations', status:outcome, checks:assertions.passed+assertions.failed,
      assertions, scenarios, startedAt:startedAt.toISOString(), completedAt:new Date().toISOString(),
      durationMs:Date.now()-startedAt.getTime(), environment:'isolated Miniflare D1/R2 with synthetic identities and mocked email transport',
      emailTransport:'disabled in application; mocked in outbox tests', basketTests:0, ...(failure ? {failure} : {})
    }, null, 2) + '\n');
  }
}

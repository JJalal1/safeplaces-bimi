import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {appendFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// This gate only reads Cloudflare metadata and migration evidence. It contains
// no migration runner, schema repair, deployment operation or approval bypass.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const accountId = 'b67109c9489a46ae25fb36370c4ba880';
const databaseId = 'd0d80657-6032-40b4-af39-407731d3c972';
const databaseName = 'safeplaces-staging';
const migrationName = '0004_operations.sql';
const apiRoot = 'https://api.cloudflare.com/client/v4';
const databasePath = `/accounts/${accountId}/d1/database/${databaseId}`;
const tableNames = ['request_events','request_drafts','notification_outbox','contacts','orders','quotes','files','safeplaces_migrations'];
const placeholders = tableNames.map(() => '?').join(',');
const schemaSQL = `SELECT name,type,tbl_name,sql FROM sqlite_master WHERE (type='table' AND name IN (${placeholders})) OR (type='index' AND tbl_name IN (${placeholders}))`;
const columnsSQL = `SELECT m.name AS table_name,p.name AS column_name,p.type,p."notnull" AS not_null,p.pk AS primary_key,p.dflt_value FROM sqlite_master AS m JOIN pragma_table_info(m.name) AS p WHERE m.type='table' AND m.name IN (${placeholders}) ORDER BY m.name,p.cid`;
const indexesSQL = `SELECT m.name AS table_name,l.name AS index_name,l."unique" AS is_unique,l.partial,i.seqno,i.name AS column_name FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS l JOIN pragma_index_info(l.name) AS i WHERE m.type='table' AND m.name IN (${placeholders}) ORDER BY m.name,l.name,i.seqno`;
const ledgerSQL = 'SELECT name,sha256,applied_at,backup_bookmark FROM safeplaces_migrations WHERE name=?';
const allowedQueries = new Set([schemaSQL,columnsSQL,indexesSQL,ledgerSQL]);
const textColumn = (name, required = true, primary = false, defaultValue = null) => ({name,type:'TEXT',required,primary,defaultValue});
const expectedColumns = {
  request_events: [textColumn('id',true,true),textColumn('request_type'),textColumn('request_id'),textColumn('actor_id',false),textColumn('actor_label'),textColumn('kind'),textColumn('visibility',true,false,"'internal'"),textColumn('body',false),textColumn('from_status',false),textColumn('to_status',false),textColumn('idempotency_key'),textColumn('created_at')],
  request_drafts: [textColumn('id',true,true),textColumn('request_type'),textColumn('request_id'),textColumn('body'),textColumn('updated_by'),textColumn('updated_at')],
  notification_outbox: [textColumn('id',true,true),textColumn('request_type'),textColumn('request_id'),textColumn('kind'),textColumn('recipient'),textColumn('sender',false),textColumn('subject'),textColumn('body'),textColumn('status'),{name:'attempts',type:'INTEGER',required:true,primary:false,defaultValue:'0'},textColumn('next_attempt_at'),textColumn('lock_until',false),textColumn('provider_id',false),textColumn('last_error',false),textColumn('idempotency_key'),textColumn('created_at'),textColumn('updated_at'),textColumn('sent_at',false)]
};
const expectedIndexes = [
  {table:'request_events',name:'request_events_parent_idx',columns:['request_type','request_id','created_at']},
  {table:'notification_outbox',name:'notification_outbox_due_idx',columns:['status','next_attempt_at']},
  {table:'notification_outbox',name:'notification_outbox_parent_idx',columns:['request_type','request_id','created_at']},
  {table:'notification_outbox',name:'notification_outbox_active_reply_unique',columns:['request_type','request_id'],unique:true,partial:true},
  {table:'contacts',name:'contacts_idempotency_unique',columns:['idempotency_key'],unique:true},
  {table:'orders',name:'orders_status_created_idx',columns:['status','created_at']},
  {table:'quotes',name:'quotes_status_created_idx',columns:['status','created_at']},
  {table:'contacts',name:'contacts_status_created_idx',columns:['status','created_at']},
  {table:'files',name:'files_unattached_created_idx',columns:['parent_id','created_at']},
  {table:'request_events',columns:['idempotency_key'],unique:true},
  {table:'request_drafts',columns:['request_type','request_id'],unique:true},
  {table:'notification_outbox',columns:['idempotency_key'],unique:true}
];
const requiredChecks = {
  request_events: ["check(request_typein('orders','quotes','contacts'))","check(visibilityin('internal','customer'))"],
  request_drafts: ["check(request_typein('orders','quotes','contacts'))"],
  notification_outbox: ["check(request_typein('orders','quotes','contacts'))","check(statusin('blocked','queued','processing','sent','failed','cancelled'))"]
};
const activeReplyPredicate = "kind='customer_reply'andstatusin('queued','processing')";

class ReadinessBlock extends Error {
  constructor(code, message, missing = []) {super(message); this.code = code; this.missing = missing;}
}
const block = (code, message, missing) => {throw new ReadinessBlock(code,message,missing);};
function normalizedSQL(sql) {
  // Normalize whitespace/identifier quoting, while preserving string values.
  return String(sql || '').match(/'(?:''|[^'])*'|[^']+/g)?.map(part => part.startsWith("'") ? part : part.replace(/[\s`"\[\]]/g,'').toLowerCase()).join('') || '';
}
function checkConfiguration(config, label) {
  const bindings = config?.d1_databases;
  if (config?.name !== databaseName || bindings?.length !== 1 || bindings[0].binding !== 'DB' || bindings[0].database_name !== databaseName || bindings[0].database_id !== databaseId || (config.account_id && config.account_id !== accountId)) {
    block('STAGING_TARGET_MISMATCH', `${label} does not identify the exact authorized staging Worker and D1 binding.`);
  }
}
function checkSchema(schemaRows, columnRows, indexRows) {
  const missing = [];
  const columns = new Map();
  for (const row of columnRows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Map());
    columns.get(row.table_name).set(row.column_name,row);
  }
  for (const [table,spec] of Object.entries(expectedColumns)) {
    const actual = columns.get(table) || new Map();
    if (actual.size !== spec.length) missing.push(table + ':column-set');
    for (const expected of spec) {
      const row = actual.get(expected.name);
      if (!row || String(row.type).toUpperCase() !== expected.type || Boolean(row.not_null) !== expected.required || Boolean(row.primary_key) !== expected.primary || row.dflt_value !== expected.defaultValue) missing.push(table + '.' + expected.name);
    }
  }
  const contactKey = columns.get('contacts')?.get('idempotency_key');
  if (!contactKey || String(contactKey.type).toUpperCase() !== 'TEXT' || contactKey.not_null || contactKey.primary_key) missing.push('contacts.idempotency_key');
  const ledger = columns.get('safeplaces_migrations');
  for (const name of ['name','sha256','applied_at','backup_bookmark']) {
    const column = ledger?.get(name);
    if (!column || String(column.type).toUpperCase() !== 'TEXT' || (name === 'name' ? !column.primary_key : !column.not_null)) missing.push('safeplaces_migrations.' + name);
  }
  const indexes = new Map();
  for (const row of indexRows) {
    const key = row.table_name + ':' + row.index_name;
    if (!indexes.has(key)) indexes.set(key,{table:row.table_name,name:row.index_name,unique:!!row.is_unique,partial:!!row.partial,columns:[]});
    indexes.get(key).columns.push(row.column_name);
  }
  for (const expected of expectedIndexes) {
    if (![...indexes.values()].some(actual => actual.table === expected.table && (!expected.name || actual.name === expected.name) && actual.unique === !!expected.unique && actual.partial === !!expected.partial && JSON.stringify(actual.columns) === JSON.stringify(expected.columns))) missing.push(expected.name || expected.table + ':unique(' + expected.columns.join(',') + ')');
  }
  for (const [table,checks] of Object.entries(requiredChecks)) {
    const normalized = normalizedSQL(schemaRows.find(row => row.type === 'table' && row.name === table)?.sql);
    for (const check of checks) if (!normalized.includes(check)) missing.push(table + ':constraint');
  }
  const indexDefinition = schemaRows.find(row => row.type === 'index' && row.name === 'notification_outbox_active_reply_unique')?.sql || '';
  const predicate = /\bwhere\s+([\s\S]+)$/i.exec(indexDefinition)?.[1];
  if (normalizedSQL(predicate).replace(/;$/,'') !== activeReplyPredicate) missing.push('notification_outbox_active_reply_unique:predicate');
  if (missing.length) block('OPERATIONS_SCHEMA_MISMATCH','Staging deployment is paused because the operations schema does not match the reviewed release. Schema changes require the separate explicit approval; this gate cannot perform them.',[...new Set(missing)]);
}

async function inspectReadiness({env,hash,config,bundleConfig,fetcher = fetch}) {
  const checkedAt = new Date().toISOString();
  let reads = 0;
  const report = {checkedAt,accountId,databaseId,databaseName,migration:{name:migrationName,sha256:hash},readOnly:true};
  try {
    if (env.CLOUDFLARE_ACCOUNT_ID !== accountId) block('STAGING_TARGET_MISMATCH','The Cloudflare account must match the exact staging account.');
    checkConfiguration(config,'Source configuration');
    if (bundleConfig) checkConfiguration(bundleConfig,'Built configuration');
    const token = (env.CLOUDFLARE_API_TOKEN || '').replace(/\s+/g,'');
    if (!/^[A-Za-z0-9._-]{20,}$/.test(token)) block('CREDENTIALS_UNAVAILABLE','The staging read-only readiness check needs a valid Cloudflare environment secret.');
    const read = async (sql,params = []) => {
      if (sql && (!allowedQueries.has(sql) || !/^SELECT\b/i.test(sql) || sql.includes(';'))) block('READ_ONLY_QUERY_REJECTED','Only the gate\'s fixed metadata queries are permitted.');
      reads++;
      const response = await fetcher(apiRoot + databasePath + (sql ? '/query' : ''), {
        method:sql ? 'POST' : 'GET',
        headers:{Authorization:'Bearer ' + token,...(sql ? {'Content-Type':'application/json'} : {})},
        ...(sql ? {body:JSON.stringify({sql,params})} : {}),
        signal:AbortSignal.timeout(20000)
      });
      let payload;
      try {payload = await response.json();} catch {block('CLOUDFLARE_READ_FAILED','Cloudflare did not return a valid readiness response. Deployment remains blocked.');}
      if (!response.ok || !payload.success) {
        const codes = (Array.isArray(payload.errors) ? payload.errors : []).map(error => String(error.code)).filter(code => /^\d{1,8}$/.test(code));
        const denied = [401,403].includes(response.status);
        block(denied ? 'CLOUDFLARE_D1_READ_DENIED' : 'CLOUDFLARE_READ_FAILED',
          `Cloudflare could not verify staging ${sql ? 'schema evidence' : 'database metadata'} (HTTP ${response.status}${codes.length ? '; provider codes ' + codes.join(', ') : ''}). ${denied ? 'Check the staging environment token and its D1 Read permission for the exact account. ' : ''}Deployment remains blocked; no migration was attempted.`);
      }
      if (!sql) return payload.result;
      if (!Array.isArray(payload.result) || payload.result.length !== 1 || payload.result[0].success !== true || !Array.isArray(payload.result[0].results)) block('CLOUDFLARE_READ_FAILED','The metadata query result was incomplete. Deployment remains blocked.');
      if (Number(payload.result[0].meta?.changes || 0) !== 0 || Number(payload.result[0].meta?.rows_written || 0) !== 0) block('READ_ONLY_RESULT_REJECTED','The readiness response did not report a read-only query. Deployment remains blocked.');
      return payload.result[0].results;
    };
    const metadata = await read();
    if (metadata?.uuid !== databaseId || metadata?.name !== databaseName) block('STAGING_TARGET_MISMATCH','Cloudflare returned a database other than the exact authorized staging database.');
    const schema = await read(schemaSQL,[...tableNames,...tableNames]);
    const present = new Set(schema.filter(row => row.type === 'table').map(row => row.name));
    const missing = tableNames.filter(name => !present.has(name));
    if (missing.length) block('MIGRATION_PENDING_APPROVAL','Staging deployment is paused pending explicit approval and application of the reviewed operations migration. Required schema or migration-ledger evidence is missing. This read-only gate does not apply migrations.',missing);
    const [columns,indexes] = await Promise.all([read(columnsSQL,tableNames),read(indexesSQL,tableNames)]);
    checkSchema(schema,columns,indexes);
    const ledger = await read(ledgerSQL,[migrationName]);
    if (ledger.length !== 1) block('MIGRATION_PENDING_APPROVAL','Staging deployment is paused: the exact migration has no recorded approved application. Explicit approval and matching ledger evidence are required.');
    const entry = ledger[0];
    if (entry.name !== migrationName || entry.sha256 !== hash) block('MIGRATION_CHECKSUM_MISMATCH','The recorded migration fingerprint does not match this release. Deployment is blocked; the database is not changed.');
    if (typeof entry.applied_at !== 'string' || !Number.isFinite(Date.parse(entry.applied_at)) || typeof entry.backup_bookmark !== 'string' || !entry.backup_bookmark.trim()) block('MIGRATION_EVIDENCE_INCOMPLETE','The migration ledger lacks a valid application time or recovery bookmark. Deployment is blocked.');
    return {...report,ready:true,code:'READY',message:'The exact staging target, operations schema and migration fingerprint are verified by read-only queries.',reads};
  } catch (error) {
    return {...report,ready:false,code:error instanceof ReadinessBlock ? error.code : 'READINESS_UNAVAILABLE',message:error instanceof ReadinessBlock ? error.message : 'Read-only readiness verification could not complete. Deployment remains blocked.',...(error instanceof ReadinessBlock && error.missing.length ? {missing:error.missing} : {}),reads};
  }
}

async function selfTest(hash,config) {
  const fixture = {
    metadata:{uuid:databaseId,name:databaseName},
    schema:tableNames.map(name => ({name,type:'table',tbl_name:name,sql:(requiredChecks[name] || []).join(' ')})),
    columns:Object.entries(expectedColumns).flatMap(([table,spec]) => spec.map(column => ({table_name:table,column_name:column.name,type:column.type,not_null:Number(column.required),primary_key:Number(column.primary),dflt_value:column.defaultValue}))),
    indexes:expectedIndexes.flatMap((index,number) => index.columns.map((column,seqno) => ({table_name:index.table,index_name:index.name || 'fixture_unique_' + number,is_unique:Number(!!index.unique),partial:Number(!!index.partial),seqno,column_name:column}))),
    ledger:[{name:migrationName,sha256:hash,applied_at:'2026-10-17T22:00:00Z',backup_bookmark:'local-fixture-bookmark'}]
  };
  fixture.schema.push({name:'notification_outbox_active_reply_unique',type:'index',tbl_name:'notification_outbox',sql:"WHERE kind='customer_reply' AND status IN ('queued','processing')"});
  fixture.columns.push({table_name:'contacts',column_name:'idempotency_key',type:'TEXT',not_null:0,primary_key:0,dflt_value:null});
  for (const name of ['name','sha256','applied_at','backup_bookmark']) fixture.columns.push({table_name:'safeplaces_migrations',column_name:name,type:'TEXT',not_null:name === 'name' ? 0 : 1,primary_key:name === 'name' ? 1 : 0,dflt_value:null});
  const cases = [
    {name:'complete schema and matching fingerprint',code:'READY'},
    {name:'missing ledger table',code:'MIGRATION_PENDING_APPROVAL',change:data => {data.schema = data.schema.filter(row => row.name !== 'safeplaces_migrations');}},
    {name:'missing operation table',code:'MIGRATION_PENDING_APPROVAL',change:data => {data.schema = data.schema.filter(row => row.name !== 'request_events');}},
    {name:'missing migration row',code:'MIGRATION_PENDING_APPROVAL',change:data => {data.ledger = [];}},
    {name:'different release fingerprint',code:'MIGRATION_CHECKSUM_MISMATCH',change:data => {data.ledger[0].sha256 = '0'.repeat(64);}},
    {name:'different remote database',code:'STAGING_TARGET_MISMATCH',change:data => {data.metadata.uuid = 'unrelated-database';}},
    {name:'missing sender column',code:'OPERATIONS_SCHEMA_MISMATCH',change:data => {data.columns = data.columns.filter(row => row.column_name !== 'sender');}},
    {name:'missing uniqueness protection',code:'OPERATIONS_SCHEMA_MISMATCH',change:data => {data.indexes = data.indexes.filter(row => row.index_name !== 'notification_outbox_active_reply_unique');}},
    {name:'different partial predicate',code:'OPERATIONS_SCHEMA_MISMATCH',change:data => {data.schema.at(-1).sql = "WHERE status='queued'";}},
    {name:'missing check constraint',code:'OPERATIONS_SCHEMA_MISMATCH',change:data => {data.schema.find(row => row.name === 'request_events').sql = '';}},
    {name:'missing recovery evidence',code:'MIGRATION_EVIDENCE_INCOMPLETE',change:data => {data.ledger[0].backup_bookmark = '';}},
    {name:'wrong environment account',code:'STAGING_TARGET_MISMATCH',account:'unrelated-account'},
    {name:'missing credential',code:'CREDENTIALS_UNAVAILABLE',token:''},
    {name:'denied Cloudflare metadata',code:'CLOUDFLARE_D1_READ_DENIED',apiFailure:true}
  ];
  let readCalls = 0;
  for (const test of cases) {
    const data = structuredClone(fixture); test.change?.(data);
    const result = await inspectReadiness({env:{CLOUDFLARE_ACCOUNT_ID:test.account || accountId,CLOUDFLARE_API_TOKEN:test.token ?? 'synthetic-fixture-token-not-a-real-secret'},hash,config,fetcher:async (url,options) => {
      readCalls++;
      assert.ok([apiRoot + databasePath,apiRoot + databasePath + '/query'].includes(url));
      if (test.apiFailure) return Response.json({success:false},{status:403});
      if (options.method === 'GET') {assert.equal(url,apiRoot + databasePath); return Response.json({success:true,result:data.metadata});}
      assert.equal(options.method,'POST');
      const {sql} = JSON.parse(options.body);
      assert.ok(allowedQueries.has(sql) && /^SELECT\b/.test(sql) && !sql.includes(';'));
      const rows = sql === schemaSQL ? data.schema : sql === columnsSQL ? data.columns : sql === indexesSQL ? data.indexes : data.ledger;
      return Response.json({success:true,result:[{success:true,results:rows,meta:{changes:0,rows_written:0}}]});
    }});
    assert.equal(result.code,test.code,test.name);
    assert.equal(result.ready,test.code === 'READY',test.name);
  }
  console.log(`PASS: ${cases.length} fail-closed readiness cases; ${readCalls} mocked metadata reads; no Cloudflare connection or mutation`);
}

const hash = createHash('sha256').update(readFileSync(resolve(root,'drizzle',migrationName))).digest('hex');
let config;
try {config = JSON.parse(readFileSync(resolve(root,'wrangler.staging.jsonc'),'utf8'));}
catch {config = null;}
if (process.argv.includes('--self-test')) {
  await selfTest(hash,config);
} else {
  let bundleConfig, bundleError = false;
  if (process.argv.includes('--check-bundle')) {
    try {bundleConfig = JSON.parse(readFileSync(resolve(root,'dist/server/wrangler.json'),'utf8'));}
    catch {bundleError = true;}
  }
  const result = bundleError
    ? {checkedAt:new Date().toISOString(),accountId,databaseId,databaseName,migration:{name:migrationName,sha256:hash},ready:false,readOnly:true,code:'BUILT_CONFIGURATION_UNAVAILABLE',message:'The staging bundle configuration is unavailable. Deployment remains blocked.',reads:0}
    : await inspectReadiness({env:process.env,hash,config,bundleConfig});
  const evidenceDirectory = resolve(root,'test-results');
  mkdirSync(evidenceDirectory,{recursive:true});
  writeFileSync(resolve(evidenceDirectory,'staging-operations-readiness.json'),JSON.stringify(result,null,2) + '\n');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,`ready=${result.ready}\nreason=${result.code}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Protected staging deployment readiness\n\n**${result.ready ? 'Ready' : 'Paused — deployment not performed'}** (${result.code})\n\n${result.message}\n\nMigration: \`${migrationName}\`  \nSHA-256: \`${hash}\`  \nDatabase: \`${databaseName}\` (\`${databaseId}\`)  \nCloudflare account: \`${accountId}\`  \nOnly fixed metadata and migration-evidence reads were permitted.\n${result.missing?.length ? '\nMissing or incompatible schema: ' + result.missing.map(item => '`' + item + '`').join(', ') + '\n' : ''}`);
  console.log(`${result.ready ? 'PASS' : 'PAUSED'}: ${result.code}: ${result.message}`);
  if (!result.ready) {
    console.log(`::warning::Protected staging deployment paused: ${result.code}. Explicit approval and verified application evidence are required before the release can proceed.`);
    if (process.argv.includes('--require-ready')) process.exitCode = 1;
  }
}

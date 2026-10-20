import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// This one-off diagnostic is pinned to the reviewed simulator fixture and SQL.
// It must never discover a replacement identity or send authentication mail.
const API_URL = 'https://api.cloudflare.com/client/v4/accounts/b67109c9489a46ae25fb36370c4ba880/d1/database/da06d822-b7ee-4a14-b3a5-7bcbc5839821/query';
const PLAN_SHA256 = 'ff1097f120cc557e1b43890a9073909dbe3dd11b1b1e7bc126c7c84f80043d4f';
const FIXTURE_ID = '02f762db-ea6c-4384-929a-fc94a22a8801';
const FIXTURE_COMMIT = 'b50b0775a7f0f084e808d601b34984dc6bffa193';
const FIXTURE_EMAIL = 'delivered+safeplaces-auth-b50b0775a7f0@resend.dev';
const FIXTURE_PARAMS = [FIXTURE_ID, FIXTURE_COMMIT, FIXTURE_EMAIL];
const PREFLIGHT_EXPECTED = {
  exact_identity_rows: 1,
  simulator_profile_matches: 1,
  session_rows: 0,
  account_rows: 1,
  credential_only_rows: 1,
  verification_reference_rows: 0,
  has_other_references: 0,
};
const POSTCONDITION_EXPECTED = {
  user_id_rows: 0,
  alias_rows: 0,
  account_rows: 0,
  session_rows: 0,
  verification_reference_rows: 0,
};
const SQL_REFERENCES = Object.freeze({
  auth_user: ['id', 'name', 'email', 'email_verified'],
  auth_session: ['id', 'user_id'],
  auth_account: ['id', 'user_id', 'account_id', 'provider_id', 'password', 'access_token', 'refresh_token', 'id_token'],
  auth_verification: ['identifier', 'value'],
  quotes: ['user_id'],
  orders: ['user_id'],
  customer_wishlists: ['user_id'],
  activity: ['user_id'],
  customers: ['id'],
  files: ['owner_id'],
  request_events: ['actor_id'],
  request_drafts: ['updated_by'],
  admin_members: ['auth_user_id', 'invited_by', 'email'],
  // This is the fixed CTE name, not a claim that a physical table is missing.
  candidate: ['id', 'email', 'email_verified', 'name'],
});
const SQL_ALIASES = Object.freeze({u: 'auth_user', s: 'auth_session', a: 'auth_account', v: 'auth_verification', c: 'candidate'});

function knownSqlReference(message, kind) {
  const match = kind === 'table'
    ? /no such table:\s*["'`\[]?([a-z_][a-z0-9_.]*)/i.exec(message)
    : /no such column:\s*["'`\[]?([a-z_][a-z0-9_.]*)/i.exec(message);
  const result = {table: null, column: null};
  if (!match) return result;
  const parts = match[1].toLowerCase().split('.');
  if (parts[0] === 'main') parts.shift();
  const resolveTable = value => Object.hasOwn(SQL_ALIASES, value)
    ? SQL_ALIASES[value] : Object.keys(SQL_REFERENCES).find(name => name === value) || null;
  if (kind === 'table') {
    if (parts.length === 1) result.table = resolveTable(parts[0]);
  } else if (parts.length === 2) {
    result.table = resolveTable(parts[0]);
    result.column = result.table
      ? SQL_REFERENCES[result.table].find(name => name === parts[1]) || null : null;
  } else if (parts.length === 1) {
    result.column = Object.values(SQL_REFERENCES).flat().find(name => name === parts[0]) || null;
    const matchingTables = Object.keys(SQL_REFERENCES).filter(name => name !== 'candidate'
      && SQL_REFERENCES[name].includes(result.column));
    if (matchingTables.length === 1) result.table = matchingTables[0];
  }
  return result;
}

// Only fixed categories/references and a bounded numeric API code leave here.
// Full provider errors can include SQL or bound values and must stay in memory.
export function classifyCloudflareError(envelope) {
  const entries = [];
  if (Array.isArray(envelope?.errors)) entries.push(...envelope.errors.slice(0, 4));
  if (typeof envelope?.error === 'string') entries.push({message: envelope.error});
  if (Array.isArray(envelope?.result)) {
    for (const item of envelope.result.slice(0, 2)) {
      if (typeof item?.error === 'string') entries.push({message: item.error});
      if (Array.isArray(item?.errors)) entries.push(...item.errors.slice(0, 4));
    }
  }
  let apiErrorCode = null;
  for (const entry of entries) {
    const value = entry?.code;
    const code = typeof value === 'number' ? value
      : typeof value === 'string' && /^\d{1,6}$/.test(value) ? Number(value) : null;
    if (Number.isInteger(code) && code >= 0 && code <= 999999) {
      apiErrorCode = code;
      break;
    }
  }
  for (const entry of entries) {
    if (typeof entry?.message !== 'string') continue;
    const message = entry.message.slice(0, 8192);
    let category = null;
    let reference = {table: null, column: null};
    if (/no such table:/i.test(message)) {
      category = 'sql_missing_table';
      reference = knownSqlReference(message, 'table');
    } else if (/no such column:/i.test(message)) {
      category = 'sql_missing_column';
      reference = knownSqlReference(message, 'column');
    } else if (/SQLITE_READONLY|\bread[- ]only\b/i.test(message)) {
      category = 'sql_read_only_restriction';
    } else if (/SQLITE_AUTH|\bnot authori[sz]ed\b|\bauthori[sz]ation denied\b|\bunauthori[sz]ed\b/i.test(message)) {
      category = 'sql_authorization_denied';
    } else if (/wrong number of parameters?|incorrect number of bindings|number of (?:parameter )?bindings|parameter count|binding count|too many SQL variables|SQLITE_RANGE|bind or column index out of range|D1_TYPE_ERROR/i.test(message)) {
      category = 'sql_binding_error';
    } else if (/syntax error|incomplete input|unrecognized token/i.test(message)) {
      category = 'sql_syntax_error';
    } else if (/SQLITE_CONSTRAINT|constraint failed/i.test(message)) {
      category = 'sql_constraint_failed';
    } else if (/not supported|unsupported/i.test(message)) {
      category = 'sql_unsupported_feature';
    } else if (/SQLITE_ERROR|D1_ERROR/i.test(message)) {
      category = 'sql_error_unclassified';
    }
    if (category) return {category, api_error_code: apiErrorCode, ...reference};
  }
  return {category: 'cloudflare_error_unclassified', api_error_code: apiErrorCode, table: null, column: null};
}

// Only the pinned, read-only fixture-count query can expose this bounded
// diagnostic. It cannot return account data. Credentials, links, quoted
// values and opaque identifiers are removed before any text leaves memory.
export function describeOwnedQueryFailure(envelope, credential) {
  const item = Array.isArray(envelope?.errors)
    ? envelope.errors.find(value => Number(value?.code) === 7500) : null;
  if (typeof item?.message !== 'string') return null;
  return item.message.slice(0, 4096)
    .replaceAll(credential, '[credential]')
    .replace(/\bBearer\s+\S+/gi, '[credential]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/[A-Za-z0-9.+_-]+@[A-Za-z0-9.-]+/g, '[email]')
    .replace(/"[^"]*"|'[^']*'|\x60[^\x60]*\x60/g, '[quoted]')
    .replace(/[A-Za-z0-9_\/+=-]{24,}/g, '[opaque]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ').slice(0, 512);
}

class SafeFailure extends Error {
  constructor(category, status = 'blocked', exitCode = 2) {
    super(category);
    this.category = category;
    this.status = status;
    this.exitCode = exitCode;
  }
}

function block(category, status, exitCode) {
  throw new SafeFailure(category, status, exitCode);
}

function sameObject(actual, expected) {
  return actual !== null && typeof actual === 'object' && !Array.isArray(actual)
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function loadPlan() {
  let contents;
  let plan;
  try {
    contents = readFileSync(new URL('./cleanup.sql.json', import.meta.url));
    if (createHash('sha256').update(contents).digest('hex') !== PLAN_SHA256) {
      block('plan_fingerprint_mismatch');
    }
    plan = JSON.parse(contents.toString('utf8'));
  } catch (error) {
    if (error instanceof SafeFailure) throw error;
    block('plan_unavailable_or_invalid');
  }
  if (plan.schema_version !== 1
      || plan.target?.worker !== 'safeplaces-production'
      || plan.target?.database_id !== 'da06d822-b7ee-4a14-b3a5-7bcbc5839821'
      || plan.fixture?.user_id !== FIXTURE_ID
      || plan.fixture?.commit_sha !== FIXTURE_COMMIT
      || plan.fixture?.email !== FIXTURE_EMAIL
      || plan.fixture?.customer_user_id !== 'customer:' + FIXTURE_ID
      || !sameObject(plan.preflight?.expected, PREFLIGHT_EXPECTED)
      || !sameObject(plan.postcondition?.expected, POSTCONDITION_EXPECTED)
      || plan.delete?.maximum_directly_deleted_rows !== 1
      || ['preflight', 'delete', 'postcondition'].some(key =>
        !Array.isArray(plan[key]?.params)
        || plan[key].params.length !== FIXTURE_PARAMS.length
        || FIXTURE_PARAMS.some((value, index) => plan[key].params[index] !== value))) {
    block('plan_target_mismatch');
  }
  return plan;
}

function readCounts(rows, expected) {
  if (rows.length !== 1 || rows[0] === null || typeof rows[0] !== 'object'
      || Array.isArray(rows[0])
      || Object.keys(rows[0]).length !== Object.keys(expected).length) {
    block('unexpected_query_result');
  }
  const counts = {};
  for (const key of Object.keys(expected)) {
    const value = rows[0][key];
    if (!Number.isSafeInteger(value) || value < 0) block('unexpected_query_result');
    counts[key] = value;
  }
  return counts;
}

function tokenFrom(environment, name, invalidCategory) {
  const value = environment[name];
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') block(invalidCategory);
  const token = value.replace(/\s+/g, '');
  if (token && !/^[A-Za-z0-9._-]{20,512}$/.test(token)) block(invalidCategory);
  return token;
}

// Injectable fetch is only for local, offline verification of the guards.
// Importing this module never starts the diagnostic or performs network I/O.
export async function runFixture(mode, {fetchImplementation = globalThis.fetch, environment = process.env} = {}) {
  const report = {
    schema_version: 1,
    mode: mode === 'preflight' || mode === 'cleanup' ? mode : 'invalid',
    status: 'blocked',
    category: 'not_completed',
    can_send_test: false,
    deletion_attempted: false,
    cleanup_confirmed: false,
    checks: {},
    counts: {read_requests: 0, write_requests: 0, directly_deleted_rows: 0},
    http_statuses: [],
  };
  let exitCode = 2;
  try {
    if (mode !== 'preflight' && mode !== 'cleanup') block('invalid_mode');
    const plan = loadPlan();
    const dedicatedReadToken = tokenFrom(environment, 'CLOUDFLARE_D1_READ_TOKEN', 'invalid_read_token');
    // Choose the credential once. A denied request never falls back to another.
    const readToken = dedicatedReadToken
      || tokenFrom(environment, 'CLOUDFLARE_API_TOKEN', 'invalid_read_token');
    if (!readToken) block('missing_read_token');

    async function query(statement, isDelete = false) {
      const token = isDelete
        ? tokenFrom(environment, 'CLOUDFLARE_API_TOKEN', 'invalid_write_token')
        : readToken;
      if (!token) block(isDelete ? 'missing_write_token' : 'missing_read_token');
      if (isDelete) {
        // Set this before sending: an interrupted write must not be retried.
        report.deletion_attempted = true;
        report.counts.write_requests += 1;
        report.counts.directly_deleted_rows = null;
      } else {
        report.counts.read_requests += 1;
      }
      let response;
      try {
        response = await fetchImplementation(API_URL, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(20_000),
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({sql: statement.sql, params: statement.params}),
        });
      } catch {
        block(isDelete ? 'cleanup_result_unconfirmed' : 'cloudflare_network_failure',
          isDelete ? 'unconfirmed' : 'blocked', isDelete ? 1 : 2);
      }
      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
        block(isDelete ? 'cleanup_result_unconfirmed' : 'unexpected_http_response',
          isDelete ? 'unconfirmed' : 'blocked', isDelete ? 1 : 2);
      }
      report.http_statuses.push(response.status);
      if (!response.ok) {
        let rejectedEnvelope;
        try { rejectedEnvelope = await response.json(); } catch { /* Never log a raw response. */ }
        report.diagnostic = classifyCloudflareError(rejectedEnvelope);
        if (!isDelete && statement === plan.preflight && response.status === 400
            && ['cloudflare_error_unclassified', 'sql_error_unclassified'].includes(report.diagnostic.category)) {
          report.diagnostic_detail = describeOwnedQueryFailure(rejectedEnvelope, token);
        }
        if (response.status === 403 || response.status === 401) {
          if (isDelete) report.counts.directly_deleted_rows = 0;
          block(response.status === 403 ? 'cloudflare_forbidden' : 'cloudflare_unauthorized');
        }
        const category = report.diagnostic.category === 'cloudflare_error_unclassified'
          ? 'cloudflare_http_failure' : report.diagnostic.category;
        block(isDelete ? 'cleanup_result_unconfirmed' : category,
          isDelete ? 'unconfirmed' : 'blocked', isDelete ? 1 : 2);
      }
      let envelope;
      try {
        envelope = await response.json();
      } catch {
        block(isDelete ? 'cleanup_result_unconfirmed' : 'invalid_cloudflare_response',
          isDelete ? 'unconfirmed' : 'blocked', isDelete ? 1 : 2);
      }
      // Do not expose Cloudflare's response/error text or statement metadata.
      if (envelope?.success !== true || !Array.isArray(envelope.result)
          || envelope.result.length !== 1 || envelope.result[0]?.success !== true
          || !Array.isArray(envelope.result[0].results)) {
        report.diagnostic = classifyCloudflareError(envelope);
        block(isDelete ? 'cleanup_result_unconfirmed' : 'cloudflare_query_rejected',
          isDelete ? 'unconfirmed' : 'blocked', isDelete ? 1 : 2);
      }
      return envelope.result[0].results;
    }

    const foreignKeys = await query(plan.foreign_key_checks[0]);
    if (foreignKeys.length !== 1 || foreignKeys[0]?.foreign_keys !== 1) {
      block('foreign_keys_disabled');
    }
    report.checks.foreign_keys_enabled = true;
    for (const [index, field] of [[1, 'account_delete_cascade'], [2, 'session_delete_cascade']]) {
      const check = plan.foreign_key_checks[index];
      const rows = await query(check);
      const matches = rows.filter(row => row !== null && typeof row === 'object'
        && Object.entries(check.required_row).every(([key, value]) => row[key] === value));
      if (matches.length !== 1) block('cascade_mismatch');
      report.checks[field] = true;
    }

    const before = readCounts(await query(plan.preflight), PREFLIGHT_EXPECTED);
    report.counts.preflight = before;

    async function confirmClean() {
      const after = readCounts(await query(plan.postcondition), POSTCONDITION_EXPECTED);
      report.counts.postcondition = after;
      if (!sameObject(after, POSTCONDITION_EXPECTED)) block('cleanup_postcondition_failed');
      for (const [index, field] of [[0, 'account_foreign_keys_consistent'], [1, 'session_foreign_keys_consistent']]) {
        const rows = await query(plan.foreign_key_postconditions[index]);
        if (rows.length !== 0) block('foreign_key_postcondition_failed');
        report.checks[field] = true;
      }
      report.cleanup_confirmed = true;
    }

    if (before.exact_identity_rows === 0) {
      if (Object.values(before).some(value => value !== 0)) block('preflight_guard_failed');
      await confirmClean();
      report.status = 'already_clean';
      report.category = 'already_clean';
      // A nonzero preflight exit prevents the following mail-observation step.
      return {exitCode: mode === 'preflight' ? 3 : 0, report};
    }
    if (!sameObject(before, PREFLIGHT_EXPECTED)) block('preflight_guard_failed');
    report.checks.exact_fixture_guard = true;
    if (mode === 'preflight') {
      report.status = 'ready';
      report.category = 'preflight_passed';
      report.can_send_test = true;
      return {exitCode: 0, report};
    }

    // The reviewed DELETE repeats every identity and ownership guard atomically.
    // Only auth_user is deleted directly; account removal requires its cascade.
    const deleted = await query(plan.delete, true);
    if (deleted.length > 1 || (deleted.length === 1
        && !sameObject(deleted[0], {id: FIXTURE_ID}))) {
      block('unexpected_delete_result', 'unconfirmed', 1);
    }
    report.counts.directly_deleted_rows = deleted.length;
    await confirmClean();
    report.status = deleted.length === 1 ? 'cleaned' : 'already_clean';
    report.category = deleted.length === 1 ? 'cleanup_confirmed' : 'already_clean';
    exitCode = 0;
  } catch (error) {
    // Never serialize a caught error, its message/cause, headers, or response.
    report.status = error instanceof SafeFailure ? error.status : 'blocked';
    report.category = error instanceof SafeFailure ? error.category : 'unexpected_local_failure';
    exitCode = error instanceof SafeFailure ? error.exitCode : 1;
  }
  return {exitCode, report};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.length === 3 ? process.argv[2] : undefined;
  const result = await runFixture(mode);
  const filename = mode === 'cleanup' ? 'auth-mail-cleanup.json' : 'auth-mail-preflight.json';
  try {
    writeFileSync(filename, JSON.stringify(result.report, null, 2) + '\n', {mode: 0o600});
  } catch {
    result.report.status = 'blocked';
    result.report.category = 'evidence_write_failed';
    result.exitCode = 1;
  }
  console.log(JSON.stringify(result.report));
  process.exitCode = result.exitCode;
}

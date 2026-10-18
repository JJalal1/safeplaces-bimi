import assert from 'node:assert/strict';

// The deployment starts with logs and traces disabled. This guard enables logs
// and query-string redaction together, then verifies the remote configuration.
// It never reads secret values, changes bindings, or accepts a different target.
const accountId = 'b67109c9489a46ae25fb36370c4ba880';
const workerName = 'safeplaces-staging';
const apiRoot = 'https://api.cloudflare.com/client/v4';
const workerPath = `/accounts/${accountId}/workers/scripts/${workerName}`;
const zoneId = '6c990a516bf39bdaa9e6c2fcbd083aa7';
const sendingDomain = 'safeplaces.sa';
const requiredSecrets = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BETTER_AUTH_SECRET'];

class ProtectionBlock extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const block = (code, message) => { throw new ProtectionBlock(code, message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function optionalObservability(current) {
  // Copy documented optional fields explicitly, never whole API objects. These
  // preserve existing destinations/settings without introducing new exporters.
  const result = {logs:{}, traces:{}};
  if (typeof current?.issues?.enabled === 'boolean') result.issues = {enabled:current.issues.enabled};
  for (const kind of ['logs', 'traces']) {
    const destinations = current?.[kind]?.destinations;
    if (Array.isArray(destinations) && destinations.every(item => typeof item === 'string')) {
      result[kind].destinations = [...destinations];
    }
  }
  const traces = current?.traces;
  if (typeof traces?.persist === 'boolean') result.traces.persist = traces.persist;
  if (typeof traces?.head_sampling_rate === 'number' && traces.head_sampling_rate >= 0 && traces.head_sampling_rate <= 1) result.traces.head_sampling_rate = traces.head_sampling_rate;
  if (['authenticated', 'accept', null].includes(traces?.propagation_policy)) result.traces.propagation_policy = traces.propagation_policy;
  return result;
}

function protectedObservability(current) {
  const optional = optionalObservability(current);
  return {
    ...(optional.issues ? {issues:optional.issues} : {}),
    enabled:true,
    head_sampling_rate:1,
    redact_query_string:true,
    logs:{...optional.logs, enabled:true, invocation_logs:true, head_sampling_rate:1, persist:true},
    traces:{...optional.traces, enabled:false},
  };
}

function protectionVerified(settings) {
  const observation = settings?.observability;
  return observation?.enabled === true && observation.head_sampling_rate === 1 && observation.redact_query_string === true
    && observation.logs?.enabled === true && observation.logs.invocation_logs === true
    && observation.logs.head_sampling_rate === 1 && observation.logs.persist === true
    && observation.traces?.enabled === false;
}

function disabledVerified(settings) {
  const observation = settings?.observability;
  return observation?.enabled === false && observation.logs?.enabled === false
    && observation.logs.invocation_logs === false && observation.traces?.enabled === false;
}

async function ensureEmailSendingDomain({token, fetcher = fetch}) {
  const call = async (method, path, body) => {
    let response;
    try {
      response = await fetcher(apiRoot + path, {
        method,
        headers:{Authorization:`Bearer ${token}`, Accept:'application/json', ...(body ? {'Content-Type':'application/json'} : {})},
        ...(body ? {body:JSON.stringify(body)} : {}),
        redirect:'error',
        signal:AbortSignal.timeout(20000),
      });
    } catch {
      return {ok:false, code:'EMAIL_SERVICE_UNAVAILABLE'};
    }
    let payload;
    try { payload = await response.json(); }
    catch { return {ok:false, code:'EMAIL_SERVICE_RESPONSE_INVALID'}; }
    if (!response.ok || payload?.success !== true || !Array.isArray(payload.errors) || payload.errors.length !== 0) {
      const providerCodes = Array.isArray(payload?.errors) ? payload.errors.map(error => String(error?.code || '')).filter(code => /^\d{1,8}$/.test(code)).slice(0,3) : [];
      return {ok:false, code:response.status === 401 || response.status === 403 ? 'EMAIL_SERVICE_PERMISSION_DENIED' : 'EMAIL_SERVICE_REQUEST_FAILED', providerCodes};
    }
    return {ok:true, result:payload.result};
  };
  const path = `/zones/${zoneId}/email/sending/subdomains`;
  let listed = await call('GET', path);
  if (!listed.ok) return listed;
  const rows = Array.isArray(listed.result) ? listed.result : [];
  let domain = rows.find(item => object(item) && item.name === sendingDomain);
  if (!domain) {
    const created = await call('POST', path, {name:sendingDomain});
    if (!created.ok) return created;
    listed = await call('GET', path);
    if (!listed.ok) return listed;
    domain = (Array.isArray(listed.result) ? listed.result : []).find(item => object(item) && item.name === sendingDomain);
  }
  if (!object(domain) || typeof domain.id !== 'string' || !domain.id) return {ok:false, code:'EMAIL_SERVICE_DOMAIN_UNVERIFIED'};
  const status = await call('GET', `${path}/${domain.id}/dns/status`);
  if (!status.ok) return status;
  return {ok:true, code:'EMAIL_SERVICE_READY', domainId:domain.id, status:status.result};
}

async function protectStagingAuthLogs({mode, env, fetcher = fetch}) {
  let reads = 0, writes = 0, request;
  const report = {mode, readOnly:mode === 'preflight'};
  try {
    if (!['preflight', 'apply'].includes(mode)) block('MODE_REQUIRED', 'Choose exactly one supported protection mode.');
    if (env.CLOUDFLARE_ACCOUNT_ID !== accountId) block('STAGING_TARGET_MISMATCH', 'The account must match the exact authorized staging target.');
    const token = typeof env.CLOUDFLARE_API_TOKEN === 'string' ? env.CLOUDFLARE_API_TOKEN.replace(/\s+/g, '') : '';
    if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) block('CREDENTIALS_UNAVAILABLE', 'A valid staging Cloudflare environment credential is required.');

    request = async (method, resource, body) => {
      if (!((method === 'GET' && ['script-settings', 'secrets'].includes(resource)) || (method === 'PATCH' && resource === 'script-settings'))) {
        block('REQUEST_REJECTED', 'The protection guard permits only fixed staging settings operations.');
      }
      if (method === 'GET') reads++; else writes++;
      let response;
      try {
        response = await fetcher(`${apiRoot}${workerPath}/${resource}`, {
          method,
          headers:{Authorization:`Bearer ${token}`, Accept:'application/json', ...(method === 'PATCH' ? {'Content-Type':'application/json'} : {})},
          ...(method === 'PATCH' ? {body:JSON.stringify(body)} : {}),
          redirect:'error',
          signal:AbortSignal.timeout(20000),
        });
      } catch {
        block('CLOUDFLARE_UNAVAILABLE', 'The protected staging API request could not complete.');
      }
      if (response?.ok !== true || response.status !== 200 || response.redirected === true) {
        try { await response?.body?.cancel(); } catch { /* No response content is retained or reported. */ }
        block('CLOUDFLARE_REQUEST_DENIED', 'Cloudflare did not accept the protected staging API request.');
      }
      let payload;
      try { payload = await response.json(); }
      catch { block('CLOUDFLARE_RESPONSE_INVALID', 'Cloudflare did not return a valid protection response.'); }
      if (!object(payload) || payload.success !== true || !Array.isArray(payload.errors) || payload.errors.length !== 0 || !Object.hasOwn(payload, 'result')) {
        block('CLOUDFLARE_RESPONSE_INVALID', 'Cloudflare did not confirm the protection request.');
      }
      return payload.result;
    };

    const readSettings = async () => {
      const settings = await request('GET', 'script-settings');
      if (!object(settings)) block('SETTINGS_UNAVAILABLE', 'The staging script settings could not be verified.');
      return settings;
    };
    const settings = await readSettings();
    const secrets = await request('GET', 'secrets');
    if (!Array.isArray(secrets)) block('SECRETS_UNVERIFIED', 'The required staging OAuth secret names could not be verified.');
    const names = new Set(secrets.filter(secret => object(secret) && secret.type === 'secret_text').map(secret => secret.name));
    if (!requiredSecrets.every(name => names.has(name))) block('OAUTH_SECRETS_MISSING', 'Required staging OAuth secret names are missing. Authentication deployment remains blocked.');

    if (mode === 'preflight') {
      return {...report, ok:true, code:'PREFLIGHT_READY', message:'The exact staging settings endpoint and required OAuth secret names were verified without changes.', reads, writes};
    }

    // A single update introduces redaction with enabled logging. PATCH targets
    // script-level observability only; bindings and all other settings stay out
    // of the request body. Do not split redaction and enablement into two calls.
    await request('PATCH', 'script-settings', {observability:protectedObservability(settings.observability)});
    if (!protectionVerified(await readSettings())) block('PROTECTION_NOT_VERIFIED', 'The remote logging settings did not confirm OAuth query-string protection.');
    if (env.GITHUB_ACTIONS === 'true') {
      const email = await ensureEmailSendingDomain({token, fetcher});
      if (!email.ok) {
        return {...report, ok:false, code:email.code, message:`OAuth logging remains protected, but the approved Safe Places Email Sending domain could not be verified${email.providerCodes?.length ? ' (provider codes ' + email.providerCodes.join(',') + ')' : ''}. Staging email remains disabled.`, reads, writes};
      }
    }
    return {...report, ok:true, code:'PROTECTED', message:'OAuth query-string redaction and the approved log settings were read back successfully; traces remain disabled. The approved Safe Places Email Sending domain is verified when running in GitHub Actions.', reads, writes};
  } catch (error) {
    const code = error instanceof ProtectionBlock ? error.code : 'PROTECTION_UNAVAILABLE';
    let message = error instanceof ProtectionBlock ? error.message : 'The staging logging protection check could not complete.';
    let recovery;
    if (mode === 'apply' && request) {
      // Omit the redaction option here: if the provider rejects that option,
      // disabling logging must still use the basic supported settings. Even an
      // ambiguous PATCH failure is followed by a read, since it may have applied.
      let patchConfirmed = false, disabled = false;
      try {
        await request('PATCH', 'script-settings', {observability:{enabled:false, logs:{enabled:false, invocation_logs:false}, traces:{enabled:false}}});
        patchConfirmed = true;
      } catch { /* A separate read is still required; never echo provider errors. */ }
      try { disabled = disabledVerified(await request('GET', 'script-settings')); }
      catch { /* Leave the result explicitly unconfirmed. */ }
      recovery = {attempted:true, patchConfirmed, disabledVerified:disabled};
      message += disabled
        ? ' Logs and traces were confirmed disabled. The pipeline remains stopped.'
        : ' Disabling logs and traces could not be confirmed. Inspect protected staging logging before any OAuth test; the pipeline remains stopped.';
    }
    return {...report, ok:false, code, message, ...(recovery ? {recovery} : {}), reads, writes};
  }
}

async function selfTest() {
  const secretMarker = 'synthetic-sensitive-fixture-content';
  const token = 'synthetic-cloudflare-fixture-token';
  const env = {CLOUDFLARE_ACCOUNT_ID:accountId, CLOUDFLARE_API_TOKEN:` \n${token.slice(0, 10)}\r\n${token.slice(10)}\t`};
  const settingsFixture = () => ({
    logpush:false, tail_consumers:[], tags:['unrelated-fixture-tag'],
    observability:{enabled:false, issues:{enabled:false}, logs:{enabled:false, invocation_logs:false, destinations:['cloudflare']}, traces:{enabled:false, head_sampling_rate:0.1, persist:false, propagation_policy:'authenticated'}},
  });
  const ok = result => Response.json({success:true, errors:[], messages:[], result});
  let scenarios = 0;
  async function run({mode = 'preflight', override = {}, onRequest, missingSecret = false} = {}) {
    let settings = settingsFixture();
    const calls = [];
    const result = await protectStagingAuthLogs({mode, env:{...env, ...override}, fetcher:async (url, options) => {
      assert.ok([`${apiRoot}${workerPath}/script-settings`, `${apiRoot}${workerPath}/secrets`].includes(url));
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      assert.ok(['GET', 'PATCH'].includes(options.method));
      const resource = url.endsWith('/secrets') ? 'secrets' : 'script-settings';
      const body = options.body ? JSON.parse(options.body) : null;
      if (body) assert.deepEqual(Object.keys(body), ['observability']);
      if (resource === 'secrets') assert.equal(options.method, 'GET');
      calls.push({method:options.method, resource, body});
      const replacement = await onRequest?.({calls, method:options.method, resource, body, settings});
      if (replacement) return replacement;
      if (resource === 'secrets') return ok(requiredSecrets.filter((_, index) => !missingSecret || index !== 1).map(name => ({name, type:'secret_text', text:secretMarker})));
      if (options.method === 'PATCH') settings = {...settings, observability:structuredClone(body.observability)};
      return ok(settings);
    }});
    const serialized = JSON.stringify(result);
    for (const privateValue of [secretMarker, token, 'unrelated-fixture-tag']) assert.ok(!serialized.includes(privateValue));
    scenarios++;
    return {result, calls, settings};
  }

  const preflight = await run();
  assert.equal(preflight.result.code, 'PREFLIGHT_READY');
  assert.equal(preflight.result.ok, true);
  assert.equal(preflight.result.writes, 0);
  assert.deepEqual(preflight.calls.map(call => call.method), ['GET', 'GET']);

  const applied = await run({mode:'apply'});
  assert.equal(applied.result.code, 'PROTECTED');
  assert.equal(applied.result.ok, true);
  assert.deepEqual(applied.calls.map(call => call.method), ['GET', 'GET', 'PATCH', 'GET']);
  assert.ok(protectionVerified(applied.settings));
  assert.deepEqual(applied.settings.tags, ['unrelated-fixture-tag']);
  assert.deepEqual(applied.settings.observability.logs.destinations, ['cloudflare']);
  assert.equal(applied.settings.observability.traces.propagation_policy, 'authenticated');
  assert.equal(applied.settings.observability.issues.enabled, false);

  for (const mode of ['preflight', 'apply']) {
    const refused = await run({mode, override:{CLOUDFLARE_ACCOUNT_ID:'unrelated-account'}});
    assert.equal(refused.result.code, 'STAGING_TARGET_MISMATCH');
    assert.equal(refused.calls.length, 0);
  }
  const invalidToken = await run({override:{CLOUDFLARE_API_TOKEN:'invalid\u0000credential'}});
  assert.equal(invalidToken.result.code, 'CREDENTIALS_UNAVAILABLE');
  assert.equal(invalidToken.calls.length, 0);
  const missing = await run({missingSecret:true});
  assert.equal(missing.result.code, 'OAUTH_SECRETS_MISSING');
  assert.equal(missing.result.writes, 0);

  for (const failure of [
    () => Response.json({success:false, errors:[{message:secretMarker}], result:null}, {status:403}),
    () => Response.json({success:false, errors:[{message:secretMarker}], result:null}),
    () => Response.json({success:'true', errors:[], result:{}}),
    () => new Response(secretMarker, {status:200}),
    () => { throw new Error(secretMarker); },
  ]) {
    const denied = await run({onRequest:failure});
    assert.equal(denied.result.ok, false);
    assert.equal(denied.result.writes, 0);
  }

  const mismatched = await run({mode:'apply', onRequest:({method, body}) => {
    if (method === 'PATCH' && body.observability.enabled) body.observability.redact_query_string = false;
  }});
  assert.equal(mismatched.result.code, 'PROTECTION_NOT_VERIFIED');
  assert.equal(mismatched.result.ok, false);
  assert.equal(mismatched.result.recovery.disabledVerified, true);
  assert.equal(mismatched.result.writes, 2);
  assert.ok(disabledVerified(mismatched.settings));
  assert.equal(Object.hasOwn(mismatched.calls.filter(call => call.method === 'PATCH')[1].body.observability, 'redact_query_string'), false);

  const lostResponse = await run({mode:'apply', onRequest:({method, body, settings}) => {
    if (method === 'PATCH' && body.observability.enabled) {
      settings.observability = structuredClone(body.observability);
      throw new Error(secretMarker);
    }
  }});
  assert.equal(lostResponse.result.ok, false);
  assert.equal(lostResponse.result.recovery.disabledVerified, true);
  assert.ok(disabledVerified(lostResponse.settings));

  const recoveryFailure = await run({mode:'apply', onRequest:({method, body}) => {
    if (method === 'PATCH' && body.observability.enabled) body.observability.redact_query_string = false;
    else if (method === 'PATCH') return Response.json({success:false, errors:[{message:secretMarker}], result:null}, {status:403});
  }});
  assert.equal(recoveryFailure.result.ok, false);
  assert.equal(recoveryFailure.result.recovery.patchConfirmed, false);
  assert.equal(recoveryFailure.result.recovery.disabledVerified, false);
  assert.match(recoveryFailure.result.message, /could not be confirmed/);
  assert.equal(recoveryFailure.calls.at(-1).method, 'GET');

  const unconfirmedReadback = await run({mode:'apply', onRequest:({method, body, calls}) => {
    if (method === 'PATCH' && body.observability.enabled) body.observability.redact_query_string = false;
    if (method === 'GET' && calls.filter(call => call.method === 'PATCH').length === 2) throw new Error(secretMarker);
  }});
  assert.equal(unconfirmedReadback.result.ok, false);
  assert.equal(unconfirmedReadback.result.recovery.patchConfirmed, true);
  assert.equal(unconfirmedReadback.result.recovery.disabledVerified, false);

  console.log(`PASS: ${scenarios} staging OAuth log-protection security scenarios; only stubbed API requests; no credentials or provider content reported.`);
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--preflight', '--apply', '--self-test'].includes(args[0])) {
    console.error('BLOCKED: MODE_REQUIRED: Use exactly one of --preflight, --apply, or --self-test.');
    process.exitCode = 1;
  } else if (args[0] === '--self-test') {
    await selfTest();
  } else {
    const result = await protectStagingAuthLogs({mode:args[0].slice(2), env:process.env});
    console.log(`${result.ok ? 'PASS' : 'BLOCKED'}: ${result.code}: ${result.message}`);
    if (!result.ok) process.exitCode = 1;
  }
} catch {
  console.error('BLOCKED: PROTECTION_UNAVAILABLE: The staging logging guard could not complete; no provider response or credential is reported.');
  process.exitCode = 1;
}

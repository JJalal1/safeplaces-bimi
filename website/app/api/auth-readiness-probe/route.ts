import {env} from 'cloudflare:workers';
import {standaloneAuthConfig} from '../../../lib/standalone-auth-policy';
import {enabledProviders} from '../../../lib/auth-settings';
// Temporary, non-mutating private deployment diagnostic. Do not publish values.
export const dynamic='force-dynamic';
export function GET(request:Request){
 if(request.headers.get('x-safeplaces-probe')!=='safeplaces-7cb9d265-20261020-authcheck')return new Response(null,{status:404});
 const b=env as unknown as Record<string,unknown>;
 const secret=b.BETTER_AUTH_SECRET;
 const p=enabledProviders(b);
 const result={auth_enabled:b.STANDALONE_AUTH_ENABLED==='true',secret_present:typeof secret==='string',secret_min_length:typeof secret==='string'&&secret.length>=32,secret_has_outer_whitespace:typeof secret==='string'&&secret!==secret.trim(),base_url_is_expected:b.BETTER_AUTH_URL==='https://safeplaces.sa',db_bound:!!b.DB,google_id_present:typeof b.GOOGLE_CLIENT_ID==='string'&&b.GOOGLE_CLIENT_ID.trim().length>0,google_secret_present:typeof b.GOOGLE_CLIENT_SECRET==='string'&&b.GOOGLE_CLIENT_SECRET.trim().length>0,google_provider_enabled:p.includes('google'),standalone_config_ready:!!standaloneAuthConfig(b)};
 return Response.json(result,{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
}
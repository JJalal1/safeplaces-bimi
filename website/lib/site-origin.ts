import {env} from 'cloudflare:workers';
import {SITE_URL as PREVIEW_SITE_URL} from './config';

/**
 * Keep private Sites preview URLs until the public Worker is explicitly
 * enabled. Canonicals and OAuth redirect origins must match the live domain.
 * No client-controlled request Host header is ever trusted.
 */
export function siteOrigin():string{
 const vars=env as unknown as Record<string,unknown>;
 if(vars.SITE_PUBLIC!=='true')return PREVIEW_SITE_URL;
 const base=vars.BETTER_AUTH_URL;
 if(typeof base==='string'){
  try{
   const url=new URL(base);
   if(url.protocol==='https:'&&url.username===''&&url.password===''&&url.pathname==='/'&&!url.search&&!url.hash)
    return url.origin;
  }catch{}
 }
 return 'https://safeplaces.sa';
}
export function siteIndexable():boolean{
 const vars=env as unknown as Record<string,unknown>;
 return vars.SITE_PUBLIC==='true'&&vars.SITE_INDEXABLE==='true'&&siteOrigin()==='https://safeplaces.sa';
}

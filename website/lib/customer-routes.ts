export type CustomerUser={userId:string;email:string;displayName:string;fullName:string|null;provider:'supabase'|'preview'|'standalone'};
export function customerReturnPath(value:string|undefined,lang='ar'){
 const fallback='/'+(lang==='en'?'en':'ar')+'/account';
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||/[\u0000-\u001f]/.test(value))return fallback;
 try{const url=new URL(value,'https://customer.local');if(url.origin!=='https://customer.local'||!/^\/(ar|en)(\/(shop|cart|checkout|wishlist|quote|account)(\/|$)|$)/.test(url.pathname)||/^\/(ar|en)\/account\/(login|register|forgot|confirm|reset)/.test(url.pathname))return fallback;return url.pathname+url.search+url.hash;}catch{return fallback;}
}
export function customerLoginPath(lang:string,returnTo:string,reason='account'){
 return '/'+(lang==='en'?'en':'ar')+'/account/login?return_to='+encodeURIComponent(customerReturnPath(returnTo,lang))+'&reason='+encodeURIComponent(['account','wishlist','checkout'].includes(reason)?reason:'account');
}

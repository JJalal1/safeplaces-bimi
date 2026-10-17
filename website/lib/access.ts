import {getChatGPTUser} from '../app/chatgpt-auth';
import {headers} from 'next/headers';
import {getStandaloneAuth} from './better-auth-server';
import {standaloneAdmin,standaloneCustomer} from './standalone-auth-policy';
import {verifiedStaff} from './admin-members';
import {ADMIN_PERMISSIONS,type AdminPermission} from './admin-permissions';
import type {CustomerUser} from './customer-routes';
import {getDb} from '../db';
import {settings} from '../db/schema';
import {eq} from 'drizzle-orm';
import {env} from 'cloudflare:workers';

export type AdminIdentity=CustomerUser & {
 role:'owner'|'staff';
 permissions:AdminPermission[];
 adminId?:string;
};

/** Recheck the verified Better Auth session and live grants on every request. */
export async function adminUser():Promise<AdminIdentity|null>{
 const bindings=env as unknown as Record<string,string>;
 // Never grant administrators from spoofable Sites identity headers on a public Worker.
 if(bindings.STANDALONE_AUTH_ENABLED==='true'){
  const standalone=getStandaloneAuth();if(!standalone)return null;
  const session=await standalone.api.getSession({headers:await headers()});
  const identity=session?.user??null;
  const owner=standaloneAdmin(identity,bindings.STANDALONE_ADMIN_USER_ID,bindings.STANDALONE_ADMIN_EMAIL);
  if(owner)return {...owner,role:'owner',permissions:[...ADMIN_PERMISSIONS]};
  const customer=standaloneCustomer(identity);
  if(!customer)return null;
  const staff=await verifiedStaff(identity);
  if(!staff)return null;
  return {...customer,role:'staff',adminId:staff.adminId,permissions:staff.permissions};
 }
 if(bindings.SITE_PUBLIC==='true')return null;
 // Sites private-owner preview (not valid for any future independent public host).
 const user=await getChatGPTUser();
 if(!user)return null;
 const owner=await getDb().select().from(settings).where(eq(settings.key,'site-owner')).limit(1);
 return owner[0]?.value===user.userId?{...user,provider:'preview',role:'owner',permissions:[...ADMIN_PERMISSIONS]}:null;
}
export async function ownerConfigured(){const rows=await getDb().select().from(settings).where(eq(settings.key,'site-owner')).limit(1);return !!rows.length;}
export async function canBootstrap(){const config=env as unknown as Record<string,string>;return config.STANDALONE_AUTH_ENABLED!=='true'&&!getStandaloneAuth()&&config.ADMIN_BOOTSTRAP_PRIVATE==='true'&&config.SITE_PUBLIC!=='true'&&!await ownerConfigured();}

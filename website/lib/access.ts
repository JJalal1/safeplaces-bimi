import {getChatGPTUser} from '../app/chatgpt-auth';
import {headers} from 'next/headers';
import {getStandaloneAuth} from './better-auth-server';
import {standaloneAdmin} from './standalone-auth-policy';
import {getDb} from '../db';
import {settings} from '../db/schema';
import {eq} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
export async function adminUser(){const standalone=getStandaloneAuth();if(standalone){const session=await standalone.api.getSession({headers:await headers()});const bindings=env as unknown as Record<string,string>;return standaloneAdmin(session?.user??null,bindings.STANDALONE_ADMIN_USER_ID,bindings.STANDALONE_ADMIN_EMAIL);}
const user=await getChatGPTUser();if(!user)return null;const owner=await getDb().select().from(settings).where(eq(settings.key,'site-owner')).limit(1);return owner[0]?.value===user.userId?user:null;}
export async function ownerConfigured(){const rows=await getDb().select().from(settings).where(eq(settings.key,'site-owner')).limit(1);return !!rows.length;}
export async function canBootstrap(){const config=env as unknown as Record<string,string>;return !getStandaloneAuth()&&config.ADMIN_BOOTSTRAP_PRIVATE==='true'&&config.SITE_PUBLIC!=='true'&&!await ownerConfigured();}

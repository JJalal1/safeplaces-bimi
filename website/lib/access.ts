import {getChatGPTUser} from '../app/chatgpt-auth';
import {getDb} from '../db';
import {settings} from '../db/schema';
import {eq} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
export async function adminUser(){const user=await getChatGPTUser();if(!user)return null;const owner=await getDb().select().from(settings).where(eq(settings.key,'site-owner')).limit(1);return owner[0]?.value===user.userId?user:null;}
export async function ownerConfigured(){const rows=await getDb().select().from(settings).where(eq(settings.key,'site-owner')).limit(1);return !!rows.length;}
export async function canBootstrap(){const config=env as unknown as Record<string,string>;return config.ADMIN_BOOTSTRAP_PRIVATE==='true'&&config.SITE_PUBLIC!=='true'&&!await ownerConfigured();}

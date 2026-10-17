import {and,eq,isNull} from 'drizzle-orm';
import {getDb} from '../db';
import {adminMembers} from '../db/admin-schema';
import {standaloneCustomer,type VerifiedIdentity} from './standalone-auth-policy';
import {parseAdminPermissions,type AdminPermission} from './admin-permissions';

/** Staff email is only an invitation address, never itself an authenticated ID. */
export async function verifiedStaff(identity:VerifiedIdentity|null|undefined):Promise<{adminId:string;permissions:AdminPermission[]}|null>{
 const customer=standaloneCustomer(identity);
 if(!customer||!identity)return null;
 const db=getDb();
 const [invitation]=await db.select().from(adminMembers).where(eq(adminMembers.email,customer.email)).limit(1);
 if(!invitation||invitation.active!==1)return null;
 // First login requires a *verified* Google session. Atomic NULL-only binding
 // prevents an invitation from silently moving between authenticated users.
 if(!invitation.authUserId){
  await db.update(adminMembers).set({
   authUserId:identity.id,updatedAt:new Date().toISOString()
  }).where(and(eq(adminMembers.id,invitation.id),isNull(adminMembers.authUserId),eq(adminMembers.active,1)));
 }
 const [stored]=await db.select().from(adminMembers).where(eq(adminMembers.id,invitation.id)).limit(1);
 if(!stored||stored.active!==1||stored.authUserId!==identity.id)return null;
 let parsed:unknown;
 try{parsed=JSON.parse(stored.permissions);}catch{return null;}
 const permissions=parseAdminPermissions(parsed);
 if(!permissions.length)return null;
 return {adminId:identity.id,permissions};
}

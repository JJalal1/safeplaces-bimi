import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';

/**
 * Google users are customers by default. Only the independently configured
 * owner may invite staff; email invitations bind to an immutable verified
 * Better Auth user ID on the invited person's first successful Google login.
 */
export const adminMembers=sqliteTable('admin_members',{
 id:text('id').primaryKey(),
 email:text('email').notNull(),
 authUserId:text('auth_user_id'),
 permissions:text('permissions').notNull().default('[]'),
 active:integer('active').notNull().default(1),
 invitedBy:text('invited_by').notNull(),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull()
},t=>[
 uniqueIndex('admin_members_email_unique').on(t.email),
 uniqueIndex('admin_members_auth_user_unique').on(t.authUserId)
]);

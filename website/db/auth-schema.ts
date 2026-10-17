import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';

/**
 * Better Auth core models. Separate from the existing storefront's customers/orders.
 * SQLite timestamp_ms keeps values as Date objects in Drizzle.
 */
export const authUser=sqliteTable('auth_user',{
 id:text('id').primaryKey(),
 name:text('name').notNull(),
 email:text('email').notNull().unique(),
 emailVerified:integer('email_verified',{mode:'boolean'}).notNull().default(false),
 image:text('image'),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),
 updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull()
});

export const authSession=sqliteTable('auth_session',{
 id:text('id').primaryKey(),
 userId:text('user_id').notNull().references(()=>authUser.id,{onDelete:'cascade'}),
 token:text('token').notNull().unique(),
 expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),
 ipAddress:text('ip_address'),
 userAgent:text('user_agent'),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),
 updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull()
},t=>[index('auth_session_user_idx').on(t.userId)]);

export const authAccount=sqliteTable('auth_account',{
 id:text('id').primaryKey(),
 userId:text('user_id').notNull().references(()=>authUser.id,{onDelete:'cascade'}),
 accountId:text('account_id').notNull(),
 providerId:text('provider_id').notNull(),
 accessToken:text('access_token'),
 refreshToken:text('refresh_token'),
 idToken:text('id_token'),
 accessTokenExpiresAt:integer('access_token_expires_at',{mode:'timestamp_ms'}),
 refreshTokenExpiresAt:integer('refresh_token_expires_at',{mode:'timestamp_ms'}),
 scope:text('scope'),
 password:text('password'),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),
 updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull()
},t=>[index('auth_account_user_idx').on(t.userId),uniqueIndex('auth_account_provider_idx').on(t.providerId,t.accountId)]);

export const authVerification=sqliteTable('auth_verification',{
 id:text('id').primaryKey(),
 identifier:text('identifier').notNull(),
 value:text('value').notNull(),
 expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),
 updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull()
},t=>[index('auth_verification_identifier_idx').on(t.identifier)]);

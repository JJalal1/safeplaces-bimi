import { DurableObject } from 'cloudflare:workers';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { PasswordVerification } from './auth-password';

const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_HASH = /^[0-9a-f]{32}:[0-9a-f]{128}$/;

function acceptsPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH;
}

/**
 * Internal binding RPC only: no fetch handler, storage, user identifiers or
 * logs. The pinned Better Auth workerd export uses native node:crypto scrypt
 * (N=16384, r=16, p=1, 64-byte key) without changing its hash format or cost.
 * Register this class with a SQLite Durable Object migration for the Free plan.
 */
export class PasswordHasher extends DurableObject {
  async hash(password: string): Promise<string> {
    try {
      if (!acceptsPassword(password)) throw new Error('PASSWORD_HASH_UNAVAILABLE');
      return await hashPassword(password);
    } catch {
      throw new Error('PASSWORD_HASH_UNAVAILABLE');
    }
  }

  async verify(input: PasswordVerification): Promise<boolean> {
    try {
      if (!input || !acceptsPassword(input.password)) throw new Error('PASSWORD_HASH_UNAVAILABLE');
      if (typeof input.hash !== 'string' || !PASSWORD_HASH.test(input.hash)) return false;
      return await verifyPassword(input);
    } catch {
      throw new Error('PASSWORD_HASH_UNAVAILABLE');
    }
  }
}

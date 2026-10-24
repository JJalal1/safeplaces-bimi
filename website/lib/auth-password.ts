import type { PasswordHasher } from './auth-password-worker';

export interface PasswordHashBindings {
  AUTH_PASSWORD_HASHER?: unknown;
}

export interface PasswordVerification {
  hash: string;
  password: string;
}

export interface PasswordHashing {
  hash(password: string): Promise<string>;
  verify(input: PasswordVerification): Promise<boolean>;
}

type HasherNamespace = Pick<DurableObjectNamespace<PasswordHasher>, 'getByName'>;

const SHARD_COUNT = 16;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_HASH = /^[0-9a-f]{32}:[0-9a-f]{128}$/;

function unavailable(): Error {
  return new Error('PASSWORD_HASH_UNAVAILABLE');
}

function isNamespace(value: unknown): value is HasherNamespace {
  return typeof value === 'object' && value !== null &&
    'getByName' in value && typeof value.getByName === 'function';
}

/** Checks the binding shape; RPC failures are handled when it is used. */
export function passwordHashingReady(bindings: PasswordHashBindings): boolean {
  return isNamespace(bindings.AUTH_PASSWORD_HASHER);
}

function hasher(namespace: HasherNamespace) {
  // Names never depend on a password or a user. A bounded pool avoids creating
  // a separate Durable Object for every authentication request or account.
  const random = crypto.getRandomValues(new Uint8Array(1))[0];
  return namespace.getByName(`password-hasher-${random % SHARD_COUNT}`);
}

function acceptsPassword(password: unknown): password is string {
  // Better Auth enforces the minimum for signup/reset. Short login candidates
  // must still take the password verification path, including unknown users.
  return typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH;
}

/**
 * Better Auth's password hooks. Scrypt runs only inside the bound Durable
 * Object, which has its own CPU budget. This HTTP-side module has no hashing
 * implementation and never falls back when the binding is unavailable.
 */
export function passwordHashing(bindings: PasswordHashBindings): PasswordHashing {
  const namespace = bindings.AUTH_PASSWORD_HASHER;
  if (!isNamespace(namespace)) throw unavailable();

  return {
    async hash(password) {
      try {
        if (!acceptsPassword(password)) throw unavailable();
        const result = await hasher(namespace).hash(password);
        if (typeof result !== 'string' || !PASSWORD_HASH.test(result)) throw unavailable();
        return result;
      } catch {
        // Never forward an RPC/runtime error that could include input values.
        throw unavailable();
      }
    },
    async verify(input) {
      try {
        if (!input || !acceptsPassword(input.password)) throw unavailable();
        if (typeof input.hash !== 'string' || !PASSWORD_HASH.test(input.hash)) return false;
        const result = await hasher(namespace).verify(input);
        if (typeof result !== 'boolean') throw unavailable();
        return result;
      } catch {
        throw unavailable();
      }
    },
  };
}

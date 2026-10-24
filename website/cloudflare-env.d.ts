declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AUTH_PASSWORD_HASHER?: DurableObjectNamespace<import("./lib/auth-password-worker").PasswordHasher>;
  }
}

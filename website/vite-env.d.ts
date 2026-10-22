/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public commit identifier injected at build time, never a credential. */
  readonly SAFEPLACES_RELEASE:string;
}

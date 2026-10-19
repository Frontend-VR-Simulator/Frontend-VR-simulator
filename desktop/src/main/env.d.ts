// Service URLs inlined from desktop/.env at build time (see electron.vite.config.ts).
interface ImportMetaEnv {
  readonly WEB_URL?: string;
  readonly API_URL?: string;
  readonly VR_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

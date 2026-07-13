/**
 * Centralised, typed access to environment configuration.
 * Loaded once via @nestjs/config and injected where needed.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  /** Origin for absolute URLs of uploaded files (set to CDN/domain in prod). */
  publicUrl: process.env.PUBLIC_URL ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    username: process.env.DB_USERNAME ?? 'shopping',
    password: process.env.DB_PASSWORD ?? 'shopping',
    name: process.env.DB_NAME ?? 'shopping_api',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  /** GHN (Giao Hàng Nhanh) shipping carrier API. Sandbox host by default —
   *  point GHN_BASE_URL at the production gateway once live. A branch without
   *  its own `ghnShopId` falls back to GHN_DEFAULT_SHOP_ID. */
  ghn: {
    baseUrl:
      process.env.GHN_BASE_URL ??
      'https://dev-online-gateway.ghn.vn/shiip/public-api',
    token: process.env.GHN_TOKEN ?? '',
    defaultShopId: process.env.GHN_DEFAULT_SHOP_ID ?? '',
  },
  /** GHTK (Giao Hàng Tiết Kiệm) shipping carrier API — public docs at
   *  api.ghtk.vn, no sandbox host documented (their staging/prod split works
   *  differently from GHN's), so GHTK_BASE_URL defaults straight to prod. */
  ghtk: {
    baseUrl:
      process.env.GHTK_BASE_URL ?? 'https://services.giaohangtietkiem.vn',
    token: process.env.GHTK_TOKEN ?? '',
    /** "X-Client-Source" header — GHTK's partner/integration code, issued
     *  alongside the token. */
    clientSource: process.env.GHTK_CLIENT_SOURCE ?? '',
  },
});

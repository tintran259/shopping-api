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
});

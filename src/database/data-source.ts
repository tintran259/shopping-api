import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// Used by the TypeORM CLI for migrations (npm run migration:*).
loadEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USERNAME ?? 'shopping',
  password: process.env.DB_PASSWORD ?? 'shopping',
  database: process.env.DB_NAME ?? 'shopping_api',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});

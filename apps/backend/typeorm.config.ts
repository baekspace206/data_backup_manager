import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { FileMetadataEntity } from './src/database/entities';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: parseInt(configService.get('DB_PORT', '5432'), 10),
  username: configService.get('DB_USERNAME', 'savemydata'),
  password: configService.get('DB_PASSWORD', 'savemydata'),
  database: configService.get('DB_DATABASE', 'savemydata'),
  entities: [FileMetadataEntity],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
});
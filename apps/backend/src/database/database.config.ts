import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { FileMetadataEntity } from './entities';

export const createDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: parseInt(configService.get('DB_PORT', '5432'), 10),
    username: configService.get('DB_USERNAME', 'savemydata'),
    password: configService.get('DB_PASSWORD', 'savemydata'),
    database: configService.get('DB_DATABASE', 'savemydata'),
    entities: [FileMetadataEntity],
    synchronize: configService.get('DB_SYNCHRONIZE', 'true') === 'true',
    logging: configService.get('DB_LOGGING', 'false') === 'true',
    ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    retryAttempts: 3,
    retryDelay: 3000,
  };
};
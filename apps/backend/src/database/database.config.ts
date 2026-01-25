import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { FileMetadataEntity } from './entities';

export const createDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const dbHost = configService.get('DB_HOST', 'localhost');

  // Docker 환경 감지 (DB_HOST가 'postgres'이거나 DOCKER=true)
  const isDockerEnv = dbHost === 'postgres' || configService.get('DOCKER') === 'true';

  // SSL 설정: DB_SSL 환경변수로 명시적 제어, Docker 환경에서는 기본 비활성화
  const sslEnabled = configService.get('DB_SSL', isDockerEnv ? 'false' : 'false') === 'true';

  return {
    type: 'postgres',
    host: dbHost,
    port: parseInt(configService.get('DB_PORT', '5432'), 10),
    username: configService.get('DB_USERNAME', 'savemydata'),
    password: configService.get('DB_PASSWORD', 'savemydata'),
    database: configService.get('DB_DATABASE', 'savemydata'),
    entities: [FileMetadataEntity],
    synchronize: configService.get('DB_SYNCHRONIZE', 'true') === 'true',
    logging: configService.get('DB_LOGGING', 'false') === 'true',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    retryAttempts: 3,
    retryDelay: 3000,
  };
};
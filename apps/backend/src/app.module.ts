import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsModule } from './uploads/uploads.module';
import { StorageModule } from './storage/storage.module';
import { HealthController } from './health/health.controller';
import { createDatabaseConfig } from './database/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => createDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    UploadsModule,
    StorageModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
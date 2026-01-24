import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageManager } from './storage.manager';
import { FileMetadataEntity } from '../database/entities';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([FileMetadataEntity])
  ],
  providers: [StorageManager],
  exports: [StorageManager]
})
export class StorageModule {}
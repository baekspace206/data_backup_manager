import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageAdapter } from './interfaces/storage.interface';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { PostgreSQLStorageAdapter } from './adapters/postgresql-storage.adapter';
import { FileMetadataEntity } from '../database/entities';

@Injectable()
export class StorageManager {
  private currentAdapter: StorageAdapter;

  constructor(
    private configService: ConfigService,
    @InjectRepository(FileMetadataEntity)
    private readonly fileMetadataRepository: Repository<FileMetadataEntity>
  ) {
    this.initializeAdapter();
  }

  private initializeAdapter(): void {
    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const dbType = this.configService.get<string>('DB_TYPE', 'postgres');

    const config = {
      basePath: storagePath,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      allowedMimeTypes: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
        'video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/x-msvideo'
      ],
      thumbnailSize: { width: 300, height: 300 }
    };

    // PostgreSQL 어댑터 사용
    if (dbType === 'postgres') {
      this.currentAdapter = new PostgreSQLStorageAdapter(
        this.fileMetadataRepository,
        config
      );
    } else {
      // 폴백으로 로컬 스토리지 사용
      this.currentAdapter = new LocalStorageAdapter(config);
    }
  }

  getCurrentAdapter(): StorageAdapter {
    return this.currentAdapter;
  }

  async switchAdapter(adapterType: 'local' | 'external' | 'postgresql', config?: any): Promise<void> {
    switch (adapterType) {
      case 'postgresql':
        this.currentAdapter = new PostgreSQLStorageAdapter(
          this.fileMetadataRepository,
          config
        );
        break;
      case 'local':
      default:
        this.currentAdapter = new LocalStorageAdapter(config);
        break;
    }
  }
}
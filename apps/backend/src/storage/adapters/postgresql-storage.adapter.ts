import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, MoreThanOrEqual, LessThan } from 'typeorm';
import { StorageAdapter, FileMetadata, StorageConfig } from '../interfaces/storage.interface';
import { FileMetadataEntity } from '../../database/entities';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

@Injectable()
export class PostgreSQLStorageAdapter implements StorageAdapter {
  constructor(
    @InjectRepository(FileMetadataEntity)
    private readonly fileMetadataRepository: Repository<FileMetadataEntity>,
    private config: StorageConfig
  ) {
    this.ensureDirectoriesExist();
  }

  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.config.basePath, { recursive: true });
      await fs.mkdir(path.join(this.config.basePath, 'thumbnails'), { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error);
    }
  }

  async saveFile(file: Express.Multer.File, options?: any): Promise<FileMetadata> {
    const fileId = uuidv4();
    const uploadDate = new Date();
    const datePath = this.getDatePath(uploadDate);
    const fileDir = path.join(this.config.basePath, datePath);

    // 디렉토리 생성
    await fs.mkdir(fileDir, { recursive: true });

    // 파일 저장
    const fileExtension = path.extname(file.originalname);
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(fileDir, fileName);

    await fs.writeFile(filePath, file.buffer);

    // 체크섬 계산
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 파일 타입 결정
    const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';

    // 썸네일 생성 (이미지인 경우)
    let thumbnailPath: string | undefined;
    if (fileType === 'image') {
      try {
        thumbnailPath = await this.createThumbnail(file.buffer, fileId);
      } catch (error) {
        console.warn('Failed to create thumbnail:', error);
      }
    }

    // 데이터베이스에 메타데이터 저장
    const fileMetadataEntity = this.fileMetadataRepository.create({
      id: fileId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadDate,
      filePath: path.relative(this.config.basePath, filePath),
      fileType,
      checksum,
      thumbnailPath: thumbnailPath ? path.relative(this.config.basePath, path.join(this.config.basePath, thumbnailPath)) : null,
      metadata: options?.metadata || {},
      isActive: true
    });

    const savedEntity = await this.fileMetadataRepository.save(fileMetadataEntity);

    return this.entityToMetadata(savedEntity);
  }

  async getFile(id: string): Promise<Buffer> {
    const entity = await this.fileMetadataRepository.findOne({
      where: { id, isActive: true }
    });

    if (!entity) {
      throw new Error(`File not found: ${id}`);
    }

    const fullPath = path.join(this.config.basePath, entity.filePath);
    return fs.readFile(fullPath);
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      const entity = await this.fileMetadataRepository.findOne({
        where: { id, isActive: true }
      });

      if (!entity) {
        return false;
      }

      const fullPath = path.join(this.config.basePath, entity.filePath);

      // 원본 파일 삭제
      try {
        await fs.unlink(fullPath);
      } catch (error) {
        console.warn('Failed to delete file:', error);
      }

      // 썸네일 삭제 (있는 경우)
      if (entity.thumbnailPath) {
        const thumbnailFullPath = path.join(this.config.basePath, entity.thumbnailPath);
        try {
          await fs.unlink(thumbnailFullPath);
        } catch (error) {
          console.warn('Failed to delete thumbnail:', error);
        }
      }

      // 데이터베이스에서 소프트 삭제
      await this.fileMetadataRepository.update(id, { isActive: false });

      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  async listFiles(filters?: {
    date?: string;
    fileType?: 'image' | 'video';
    limit?: number;
    offset?: number;
  }): Promise<FileMetadata[]> {
    const queryOptions: FindManyOptions<FileMetadataEntity> = {
      where: { isActive: true },
      order: { uploadDate: 'DESC' }
    };

    // 필터 적용
    if (filters?.date) {
      const filterDate = new Date(filters.date);
      const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
      const endOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1);

      queryOptions.where = {
        ...queryOptions.where,
        uploadDate: MoreThanOrEqual(startOfDay)
      };
    }

    if (filters?.fileType) {
      queryOptions.where = {
        ...queryOptions.where,
        fileType: filters.fileType
      };
    }

    // 페이지네이션
    if (filters?.limit) {
      queryOptions.take = filters.limit;
    }
    if (filters?.offset) {
      queryOptions.skip = filters.offset;
    }

    const entities = await this.fileMetadataRepository.find(queryOptions);
    return entities.map(entity => this.entityToMetadata(entity));
  }

  async generateThumbnail(id: string): Promise<Buffer> {
    const entity = await this.fileMetadataRepository.findOne({
      where: { id, isActive: true }
    });

    if (!entity) {
      throw new Error(`File not found: ${id}`);
    }

    if (entity.thumbnailPath) {
      const thumbnailFullPath = path.join(this.config.basePath, entity.thumbnailPath);
      return fs.readFile(thumbnailFullPath);
    }

    // 썸네일이 없으면 원본에서 생성
    if (entity.fileType === 'image') {
      const fileBuffer = await this.getFile(id);
      return sharp(fileBuffer)
        .resize(this.config.thumbnailSize.width, this.config.thumbnailSize.height, {
          fit: 'cover'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    throw new Error('Thumbnail not available for this file type');
  }

  async getStorageInfo(): Promise<{
    totalFiles: number;
    totalSize: number;
    availableSpace: number;
    usedSpace: number;
  }> {
    const result = await this.fileMetadataRepository
      .createQueryBuilder('file')
      .select('COUNT(*)', 'totalFiles')
      .addSelect('COALESCE(SUM(file.size), 0)', 'totalSize')
      .where('file.isActive = :isActive', { isActive: true })
      .getRawOne();

    const totalFiles = parseInt(result.totalFiles, 10);
    const totalSize = parseInt(result.totalSize, 10);

    // 디스크 정보는 간단히 계산 (실제로는 시스템 정보를 가져와야 함)
    const usedSpace = totalSize;
    const availableSpace = 1024 * 1024 * 1024 * 100; // 100GB로 가정

    return {
      totalFiles,
      totalSize,
      availableSpace,
      usedSpace
    };
  }

  async getFileMetadata(id: string): Promise<FileMetadata> {
    const entity = await this.fileMetadataRepository.findOne({
      where: { id, isActive: true }
    });

    if (!entity) {
      throw new Error(`File metadata not found: ${id}`);
    }

    return this.entityToMetadata(entity);
  }

  private async createThumbnail(buffer: Buffer, fileId: string): Promise<string> {
    const thumbnailBuffer = await sharp(buffer)
      .resize(this.config.thumbnailSize.width, this.config.thumbnailSize.height, {
        fit: 'cover'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailPath = path.join('thumbnails', `${fileId}.jpg`);
    const fullThumbnailPath = path.join(this.config.basePath, thumbnailPath);

    await fs.writeFile(fullThumbnailPath, thumbnailBuffer);

    return thumbnailPath;
  }

  private getDatePath(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return path.join(year.toString(), month, day);
  }

  private entityToMetadata(entity: FileMetadataEntity): FileMetadata {
    return {
      id: entity.id,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      size: entity.size,
      uploadDate: entity.uploadDate,
      filePath: entity.filePath,
      fileType: entity.fileType,
      checksum: entity.checksum,
      thumbnailPath: entity.thumbnailPath,
      uploadedAt: entity.uploadDate // 호환성을 위한 alias
    };
  }

  // 마이그레이션 헬퍼 메서드
  async migrateFromJsonMetadata(jsonMetadataPath: string): Promise<{ migrated: number; errors: string[] }> {
    const result = { migrated: 0, errors: [] as string[] };

    try {
      const jsonData = await fs.readFile(jsonMetadataPath, 'utf-8');
      const metadata = JSON.parse(jsonData);

      for (const [fileId, fileData] of Object.entries(metadata)) {
        try {
          const existingEntity = await this.fileMetadataRepository.findOne({
            where: { id: fileId }
          });

          if (!existingEntity) {
            const entity = this.fileMetadataRepository.create({
              id: fileId,
              ...(fileData as any),
              isActive: true
            });

            await this.fileMetadataRepository.save(entity);
            result.migrated++;
          }
        } catch (error) {
          result.errors.push(`Failed to migrate ${fileId}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to read JSON metadata: ${error.message}`);
    }

    return result;
  }
}
import { Injectable } from '@nestjs/common';
import { StorageAdapter, FileMetadata, StorageConfig } from '../interfaces/storage.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
// import * as sharp from 'sharp'; // Temporarily disabled for build compatibility

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private config: StorageConfig) {
    this.ensureDirectoriesExist();
  }

  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.config.basePath, { recursive: true });
      await fs.mkdir(path.join(this.config.basePath, 'metadata'), { recursive: true });
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

    const metadata: FileMetadata = {
      id: fileId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadDate,
      filePath: path.relative(this.config.basePath, filePath),
      fileType,
      checksum
    };

    // 썸네일 생성 (이미지인 경우) - 임시로 비활성화
    // Temporarily disabled due to Sharp compilation issues
    // if (fileType === 'image') {
    //   try {
    //     const thumbnailPath = await this.createThumbnail(file.buffer, fileId);
    //     metadata.thumbnailPath = thumbnailPath;
    //   } catch (error) {
    //     console.warn('Failed to create thumbnail:', error);
    //   }
    // }

    // 메타데이터 저장
    await this.saveMetadata(metadata);

    return metadata;
  }

  async getFile(id: string): Promise<Buffer> {
    const metadata = await this.getMetadata(id);
    const fullPath = path.join(this.config.basePath, metadata.filePath);
    return fs.readFile(fullPath);
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(id);
      const fullPath = path.join(this.config.basePath, metadata.filePath);

      // 원본 파일 삭제
      await fs.unlink(fullPath);

      // 썸네일 삭제 (있는 경우)
      if (metadata.thumbnailPath) {
        const thumbnailFullPath = path.join(this.config.basePath, metadata.thumbnailPath);
        try {
          await fs.unlink(thumbnailFullPath);
        } catch (error) {
          console.warn('Failed to delete thumbnail:', error);
        }
      }

      // 메타데이터에서 제거
      await this.removeMetadata(id);

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
    const allMetadata = await this.loadAllMetadata();
    let files = Object.values(allMetadata);

    // 필터 적용
    if (filters?.date) {
      const filterDate = new Date(filters.date);
      files = files.filter(file => {
        const fileDate = new Date(file.uploadDate);
        return fileDate.toDateString() === filterDate.toDateString();
      });
    }

    if (filters?.fileType) {
      files = files.filter(file => file.fileType === filters.fileType);
    }

    // 정렬 (최신순)
    files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    // 페이지네이션
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;

    return files.slice(offset, offset + limit);
  }

  async generateThumbnail(id: string): Promise<Buffer> {
    const metadata = await this.getMetadata(id);

    if (metadata.thumbnailPath) {
      const thumbnailFullPath = path.join(this.config.basePath, metadata.thumbnailPath);
      return fs.readFile(thumbnailFullPath);
    }

    // 썸네일이 없으면 원본에서 생성 - 임시로 비활성화
    // Temporarily disabled due to Sharp compilation issues
    // if (metadata.fileType === 'image') {
    //   const fileBuffer = await this.getFile(id);
    //   return sharp(fileBuffer)
    //     .resize(this.config.thumbnailSize.width, this.config.thumbnailSize.height, {
    //       fit: 'cover'
    //     })
    //     .jpeg({ quality: 80 })
    //     .toBuffer();
    // }

    throw new Error('Thumbnail generation temporarily disabled');
  }

  async getStorageInfo(): Promise<{
    totalFiles: number;
    totalSize: number;
    availableSpace: number;
    usedSpace: number;
  }> {
    const allMetadata = await this.loadAllMetadata();
    const files = Object.values(allMetadata);

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // 디스크 정보는 간단히 계산
    const usedSpace = totalSize;
    const availableSpace = 1024 * 1024 * 1024 * 100; // 100GB로 가정

    return {
      totalFiles,
      totalSize,
      availableSpace,
      usedSpace
    };
  }

  // Temporarily disabled due to Sharp compilation issues
  // private async createThumbnail(buffer: Buffer, fileId: string): Promise<string> {
  //   const thumbnailBuffer = await sharp(buffer)
  //     .resize(this.config.thumbnailSize.width, this.config.thumbnailSize.height, {
  //       fit: 'cover'
  //     })
  //     .jpeg({ quality: 80 })
  //     .toBuffer();

  //   const thumbnailPath = path.join('thumbnails', `${fileId}.jpg`);
  //   const fullThumbnailPath = path.join(this.config.basePath, thumbnailPath);

  //   await fs.writeFile(fullThumbnailPath, thumbnailBuffer);

  //   return thumbnailPath;
  // }

  private getDatePath(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return path.join(year.toString(), month, day);
  }

  private async saveMetadata(metadata: FileMetadata): Promise<void> {
    // 전역 인덱스에 저장
    const indexPath = path.join(this.config.basePath, 'metadata', 'index.json');
    let index: Record<string, FileMetadata> = {};

    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(indexData);
    } catch (error) {
      // 파일이 없으면 새로 생성
    }

    index[metadata.id] = metadata;
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

    // 날짜별 인덱스에도 저장
    const datePath = this.getDatePath(metadata.uploadDate);
    const dateIndexPath = path.join(this.config.basePath, 'metadata', `${datePath.replace(/[\/\\]/g, '-')}.json`);

    let dateIndex: FileMetadata[] = [];
    try {
      const dateIndexData = await fs.readFile(dateIndexPath, 'utf-8');
      dateIndex = JSON.parse(dateIndexData);
    } catch (error) {
      // 파일이 없으면 새로 생성
    }

    dateIndex.push(metadata);
    await fs.writeFile(dateIndexPath, JSON.stringify(dateIndex, null, 2));
  }

  private async getMetadata(id: string): Promise<FileMetadata> {
    const allMetadata = await this.loadAllMetadata();
    const metadata = allMetadata[id];

    if (!metadata) {
      throw new Error(`File not found: ${id}`);
    }

    return metadata;
  }

  private async removeMetadata(id: string): Promise<void> {
    const indexPath = path.join(this.config.basePath, 'metadata', 'index.json');
    let index: Record<string, FileMetadata> = {};

    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(indexData);
      delete index[id];
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('Failed to remove metadata:', error);
    }
  }

  private async loadAllMetadata(): Promise<Record<string, FileMetadata>> {
    const indexPath = path.join(this.config.basePath, 'metadata', 'index.json');

    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(indexData);
    } catch (error) {
      return {};
    }
  }
}
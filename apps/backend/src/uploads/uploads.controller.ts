import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFiles,
  UseInterceptors,
  Res,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  StreamableFile
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { FileMetadata } from '../storage/interfaces/storage.interface';

@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('files')
  @UseInterceptors(FilesInterceptor('files', 10)) // 최대 10개 파일 동시 업로드
  async uploadFiles(
    @UploadedFiles() files: Array<Express.Multer.File>
  ): Promise<{ files: FileMetadata[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const uploadedFiles = await Promise.all(
      files.map(file => this.uploadsService.saveFile(file))
    );

    return { files: uploadedFiles };
  }

  @Get('files')
  async listFiles(
    @Query('date') date?: string,
    @Query('type') fileType?: 'image' | 'video',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<{ files: FileMetadata[]; total: number }> {
    const filters = {
      date,
      fileType,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    };

    const files = await this.uploadsService.listFiles(filters);
    
    return {
      files,
      total: files.length
    };
  }

  @Get('files/:id')
  async getFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    try {
      const fileBuffer = await this.uploadsService.getFile(id);
      const metadata = await this.uploadsService.getFileMetadata(id);
      
      // 한글 파일명 인코딩 처리
      const encodedFilename = encodeURIComponent(metadata.originalName);
      
      res.set({
        'Content-Type': metadata.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': metadata.size.toString(),
      });
      
      return new StreamableFile(fileBuffer);
    } catch (error) {
      throw new NotFoundException(`File not found: ${id}`);
    }
  }

  @Get('thumbnails/:id')
  async getThumbnail(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    try {
      const thumbnailBuffer = await this.uploadsService.generateThumbnail(id);
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // 1일 캐시
      });
      
      return new StreamableFile(thumbnailBuffer);
    } catch (error) {
      throw new NotFoundException(`Thumbnail not found: ${id}`);
    }
  }

  @Delete('files/:id')
  async deleteFile(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.uploadsService.deleteFile(id);
    
    if (!success) {
      throw new NotFoundException(`File not found or could not be deleted: ${id}`);
    }
    
    return { success: true };
  }

  @Get('stats')
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    imageCount: number;
    videoCount: number;
  }> {
    return this.uploadsService.getStats();
  }

  @Post('fix-filenames')
  async fixFilenames(): Promise<{ fixed: number; errors: string[] }> {
    return this.uploadsService.fixCorruptedFilenames();
  }

  @Post('migrate-to-sqlite')
  async migrateToSqlite(): Promise<{ migrated: number; errors: string[] }> {
    return this.uploadsService.migrateToSqlite();
  }
}
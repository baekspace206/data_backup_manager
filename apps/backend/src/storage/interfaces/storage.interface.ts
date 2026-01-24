export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadDate: Date;
  filePath: string;
  fileType: 'image' | 'video';
  checksum?: string;
  thumbnailPath?: string;
  uploadedAt?: Date; // 호환성을 위한 별명
}

export interface FileListResponse {
  files: FileMetadata[];
  total: number;
  page: number;
  limit: number;
}

export interface StorageAdapter {
  saveFile(file: Express.Multer.File, options?: any): Promise<FileMetadata>;
  getFile(id: string): Promise<Buffer>;
  deleteFile(id: string): Promise<boolean>;
  listFiles(filters?: {
    date?: string;
    fileType?: 'image' | 'video';
    limit?: number;
    offset?: number;
  }): Promise<FileMetadata[]>;
  generateThumbnail(id: string): Promise<Buffer>;
  getStorageInfo(): Promise<{
    totalFiles: number;
    totalSize: number;
    availableSpace: number;
    usedSpace: number;
  }>;
}

export interface StorageConfig {
  basePath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  thumbnailSize: { width: number; height: number };
}
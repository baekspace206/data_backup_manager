export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  fileType: 'image' | 'video';
  uploadedAt: string;
  checksum?: string;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export interface FileListResponse {
  files: FileMetadata[];
  total: number;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  imageCount: number;
  videoCount: number;
}
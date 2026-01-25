import { FileMetadata, FileListResponse, FileStats } from '../types/file';

// nginx 리버스프록시를 통한 상대 경로 사용 (CORS 해결)
const API_BASE = '/api';

export class ApiService {
  static async uploadFiles(
    files: File[], 
    onProgress?: (progress: number) => void
  ): Promise<FileMetadata[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.files);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${API_BASE}/uploads/files`);
      xhr.send(formData);
    });
  }

  static async getFiles(filters?: {
    date?: string;
    type?: 'image' | 'video';
    limit?: number;
    offset?: number;
  }): Promise<FileListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.date) params.append('date', filters.date);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${API_BASE}/uploads/files?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }
    
    return response.json();
  }

  static async deleteFile(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/uploads/files/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  static async getStats(): Promise<FileStats> {
    const response = await fetch(`${API_BASE}/uploads/stats`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    
    return response.json();
  }

  static getFileUrl(id: string): string {
    return `${API_BASE}/uploads/files/${id}`;
  }

  static getThumbnailUrl(id: string): string {
    return `${API_BASE}/uploads/thumbnails/${id}`;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
import React, { useState, useRef, useCallback } from 'react';
import { ApiService } from '../../services/api';
import { UploadProgress } from '../../types/file';
import './FileUpload.css';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgresses, setUploadProgresses] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
    'video/mp4', 'video/mov', 'video/avi', 'video/quicktime'
  ];

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = [];
    const maxSize = 500 * 1024 * 1024; // 500MB

    Array.from(files).forEach(file => {
      if (!acceptedTypes.includes(file.type)) {
        alert(`지원하지 않는 파일 형식입니다: ${file.name}`);
        return;
      }
      
      if (file.size > maxSize) {
        alert(`파일 크기가 너무 큽니다 (최대 500MB): ${file.name}`);
        return;
      }
      
      validFiles.push(file);
    });

    return validFiles;
  };

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);

    // 각 파일별로 진행률 초기화
    const fileIds: string[] = [];
    const initialProgresses: Record<string, UploadProgress> = {};
    files.forEach((file, index) => {
      const fileId = `${Date.now()}-${index}`;
      fileIds.push(fileId);
      initialProgresses[fileId] = {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      };
    });
    setUploadProgresses(initialProgresses);

    try {
      // 진행률 업데이트 콜백 - 실시간으로 상태 반영
      const updateProgress = (progress: number) => {
        setUploadProgresses(prev => {
          const updated: Record<string, UploadProgress> = {};
          Object.keys(prev).forEach(fileId => {
            updated[fileId] = {
              ...prev[fileId],
              progress: progress,
              status: 'uploading'
            };
          });
          return updated;
        });
      };

      await ApiService.uploadFiles(files, updateProgress);

      // 모든 파일 업로드 완료
      setUploadProgresses(prev => {
        const completed: Record<string, UploadProgress> = {};
        Object.keys(prev).forEach(fileId => {
          completed[fileId] = {
            ...prev[fileId],
            progress: 100,
            status: 'success'
          };
        });
        return completed;
      });

      onUploadComplete?.();

      // 3초 후 진행률 표시 제거
      setTimeout(() => {
        setUploadProgresses({});
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);

      // 에러 상태로 업데이트
      setUploadProgresses(prev => {
        const errorProgresses: Record<string, UploadProgress> = {};
        Object.keys(prev).forEach(fileId => {
          errorProgresses[fileId] = {
            ...prev[fileId],
            status: 'error',
            error: error instanceof Error ? error.message : '업로드 실패'
          };
        });
        return errorProgresses;
      });
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = validateFiles(e.dataTransfer.files);
    uploadFiles(files);
  }, [uploadFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = validateFiles(e.target.files);
      uploadFiles(files);
      e.target.value = ''; // 리셋
    }
  }, [uploadFiles]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-modern">
      <div
        className={`upload-zone-compact ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          multiple
          accept={acceptedTypes.join(',')}
          style={{ display: 'none' }}
        />

        <div className="upload-content-compact">
          {isUploading ? (
            <div className="uploading-state-compact">
              <div className="spinner-small" />
              <span>업로드 중...</span>
            </div>
          ) : (
            <div className="idle-state-compact">
              <span className="upload-icon-small">☁️</span>
              <span className="upload-text">파일을 드래그하거나 클릭하여 업로드</span>
              <span className="upload-hint">이미지, 비디오 (500MB 이하)</span>
            </div>
          )}
        </div>
      </div>

      {Object.keys(uploadProgresses).length > 0 && (
        <div className="upload-progress-modern">
          {Object.values(uploadProgresses).map(progress => (
            <div key={progress.fileId} className="upload-item">
              <div className="upload-item-info">
                <div className="upload-item-icon">
                  {progress.status === 'success' && '✅'}
                  {progress.status === 'error' && '❌'}
                  {progress.status === 'uploading' && '📄'}
                </div>
                <div className="upload-item-details">
                  <div className="upload-item-name">{progress.fileName}</div>
                  <div className="upload-item-status">
                    {progress.status === 'success' && '업로드 완료'}
                    {progress.status === 'error' && progress.error}
                    {progress.status === 'uploading' && `${progress.progress}% 업로드 중`}
                  </div>
                </div>
              </div>

              {progress.status === 'uploading' && (
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
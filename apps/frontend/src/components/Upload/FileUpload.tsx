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
    const initialProgresses: Record<string, UploadProgress> = {};
    files.forEach((file, index) => {
      const fileId = `${Date.now()}-${index}`;
      initialProgresses[fileId] = {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      };
    });
    setUploadProgresses(initialProgresses);

    try {
      // 전체 진행률 추적
      let totalProgress = 0;
      const updateProgress = (progress: number) => {
        totalProgress = progress;
      };

      await ApiService.uploadFiles(files, updateProgress);
      
      // 모든 파일 업로드 완료
      const completedProgresses: Record<string, UploadProgress> = {};
      Object.keys(initialProgresses).forEach(fileId => {
        completedProgresses[fileId] = {
          ...initialProgresses[fileId],
          progress: 100,
          status: 'success'
        };
      });
      setUploadProgresses(completedProgresses);
      
      onUploadComplete?.();
      
      // 3초 후 진행률 표시 제거
      setTimeout(() => {
        setUploadProgresses({});
      }, 3000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      // 에러 상태로 업데이트
      const errorProgresses: Record<string, UploadProgress> = {};
      Object.keys(initialProgresses).forEach(fileId => {
        errorProgresses[fileId] = {
          ...initialProgresses[fileId],
          status: 'error',
          error: error instanceof Error ? error.message : '업로드 실패'
        };
      });
      setUploadProgresses(errorProgresses);
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
    <div className="file-upload">
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
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
        
        <div className="upload-content">
          {isUploading ? (
            <div className="uploading-state">
              <div className="spinner" />
              <h3>업로드 중...</h3>
            </div>
          ) : (
            <div className="idle-state">
              <div className="upload-icon">📁</div>
              <h3>파일을 여기에 드래그하거나 클릭하세요</h3>
              <p>이미지 및 비디오 파일 (최대 500MB)</p>
              <p>지원 형식: JPG, PNG, GIF, WebP, HEIC, MP4, MOV, AVI</p>
            </div>
          )}
        </div>
      </div>

      {Object.keys(uploadProgresses).length > 0 && (
        <div className="upload-progress-list">
          {Object.values(uploadProgresses).map(progress => (
            <div key={progress.fileId} className="upload-progress-item">
              <div className="file-info">
                <span className="file-name">{progress.fileName}</span>
                <span className={`status ${progress.status}`}>
                  {progress.status === 'success' && '✅'}
                  {progress.status === 'error' && '❌'}
                  {progress.status === 'uploading' && `${progress.progress}%`}
                </span>
              </div>
              
              {progress.status === 'uploading' && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
              
              {progress.error && (
                <div className="error-message">{progress.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
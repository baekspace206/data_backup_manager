import React, { useEffect } from 'react';
import { FileMetadata } from '../../types/file';
import { ApiService } from '../../services/api';
import './FileViewer.css';

interface FileViewerProps {
  file: FileMetadata;
  onClose: () => void;
  onDelete: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  file,
  onClose,
  onDelete,
  onNext,
  onPrevious
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrevious?.();
          break;
        case 'ArrowRight':
          onNext?.();
          break;
        case 'Delete':
          if (confirm('정말로 이 파일을 삭제하시겠습니까?')) {
            onDelete();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious, onDelete]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = ApiService.getFileUrl(file.id);
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="file-viewer-overlay" onClick={handleBackdropClick}>
      <div className="file-viewer">
        <div className="viewer-header">
          <div className="file-info">
            <h3>{file.originalName}</h3>
            <div className="file-details">
              <span>{ApiService.formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{ApiService.formatDate(file.uploadedAt)}</span>
              <span>•</span>
              <span>{file.fileType === 'image' ? '이미지' : '비디오'}</span>
            </div>
          </div>
          
          <div className="viewer-actions">
            <button onClick={handleDownload} className="action-btn" title="다운로드">
              💾
            </button>
            <button onClick={onDelete} className="action-btn delete" title="삭제">
              🗑️
            </button>
            <button onClick={onClose} className="action-btn" title="닫기">
              ✕
            </button>
          </div>
        </div>
        
        <div className="viewer-content">
          {onPrevious && (
            <button className="nav-btn prev" onClick={onPrevious} title="이전 파일">
              ❮
            </button>
          )}
          
          <div className="media-container">
            {file.fileType === 'image' ? (
              <img
                src={ApiService.getFileUrl(file.id)}
                alt={file.originalName}
                className="viewer-image"
              />
            ) : (
              <video
                src={ApiService.getFileUrl(file.id)}
                controls
                className="viewer-video"
                preload="metadata"
              >
                <p>브라우저가 비디오를 지원하지 않습니다.</p>
              </video>
            )}
          </div>
          
          {onNext && (
            <button className="nav-btn next" onClick={onNext} title="다음 파일">
              ❯
            </button>
          )}
        </div>
        
        <div className="viewer-footer">
          <div className="keyboard-hints">
            <span>ESC: 닫기</span>
            <span>←→: 이동</span>
            <span>Del: 삭제</span>
          </div>
        </div>
      </div>
    </div>
  );
};
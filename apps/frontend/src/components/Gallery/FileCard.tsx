import React, { useState } from 'react';
import { FileMetadata } from '../../types/file';
import { ApiService } from '../../services/api';
import './FileCard.css';

interface FileCardProps {
  file: FileMetadata;
  onClick: () => void;
  onDelete: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onClick, onDelete }) => {
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = ApiService.getFileUrl(file.id);
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="file-card" onClick={onClick}>
      <div className="file-preview">
        {file.fileType === 'image' && !imageError ? (
          <img
            src={ApiService.getThumbnailUrl(file.id)}
            alt={file.originalName}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="file-icon">
            {file.fileType === 'image' ? '🖼️' : '🎬'}
          </div>
        )}
        
        <div className="file-overlay">
          <div className="file-type-badge">
            {file.fileType === 'image' ? 'IMG' : 'VID'}
          </div>
        </div>
      </div>
      
      <div className="file-info">
        <div className="file-name" title={file.originalName}>
          {file.originalName}
        </div>
        <div className="file-meta">
          <span className="file-size">
            {ApiService.formatFileSize(file.size)}
          </span>
          <span className="file-date">
            {ApiService.formatDate(file.uploadedAt)}
          </span>
        </div>
      </div>
      
      <div className="file-actions" onClick={stopPropagation}>
        <button 
          className="action-btn menu-btn"
          onClick={() => setShowMenu(!showMenu)}
        >
          ⋮
        </button>
        
        {showMenu && (
          <div className="action-menu">
            <button onClick={handleDownload} className="menu-item">
              💾 다운로드
            </button>
            <button onClick={onDelete} className="menu-item delete">
              🗑️ 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
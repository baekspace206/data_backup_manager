import React, { useState, useEffect } from 'react';
import { FileMetadata } from '../../types/file';
import { ApiService } from '../../services/api';
import { FileCard } from './FileCard';
import { FileViewer } from './FileViewer';
import './FileGallery.css';

interface FileGalleryProps {
  refreshTrigger?: number;
  viewMode?: 'grid' | 'list';
  filterType?: 'image' | 'video';
}

export const FileGallery: React.FC<FileGalleryProps> = ({ refreshTrigger, viewMode = 'grid', filterType }) => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [filters, setFilters] = useState({
    fileType: filterType as 'image' | 'video' | undefined,
    sortBy: 'newest' as 'newest' | 'oldest' | 'name' | 'size'
  });

  useEffect(() => {
    setFilters(prev => ({ ...prev, fileType: filterType }));
  }, [filterType]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ApiService.getFiles({
        type: filters.fileType,
        limit: 100
      });
      
      let sortedFiles = [...response.files];
      
      switch (filters.sortBy) {
        case 'newest':
          sortedFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
          break;
        case 'oldest':
          sortedFiles.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
          break;
        case 'name':
          sortedFiles.sort((a, b) => a.originalName.localeCompare(b.originalName));
          break;
        case 'size':
          sortedFiles.sort((a, b) => b.size - a.size);
          break;
      }
      
      setFiles(sortedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [refreshTrigger, filters]);

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('정말로 이 파일을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      await ApiService.deleteFile(fileId);
      setFiles(files.filter(f => f.id !== fileId));
      
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
    } catch (err) {
      alert('파일 삭제에 실패했습니다.');
    }
  };

  const groupFilesByDate = (files: FileMetadata[]) => {
    const groups: Record<string, FileMetadata[]> = {};
    
    files.forEach(file => {
      const date = new Date(file.uploadedAt).toLocaleDateString('ko-KR');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(file);
    });
    
    return groups;
  };

  const fileGroups = groupFilesByDate(files);
  const groupDates = Object.keys(fileGroups).sort((a, b) => 
    new Date(fileGroups[b][0].uploadedAt).getTime() - new Date(fileGroups[a][0].uploadedAt).getTime()
  );

  if (loading) {
    return (
      <div className="gallery-loading">
        <div className="spinner" />
        <p>파일을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gallery-error">
        <p>❌ {error}</p>
        <button onClick={loadFiles} className="retry-btn">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="file-gallery">
      <div className="gallery-header">
        <div className="gallery-stats">
          <span>총 {files.length}개 파일</span>
          <span>
            {ApiService.formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
          </span>
        </div>
        
        <div className="gallery-filters">
          <select 
            value={filters.fileType || ''} 
            onChange={(e) => setFilters({
              ...filters, 
              fileType: e.target.value as 'image' | 'video' || undefined
            })}
          >
            <option value="">모든 파일</option>
            <option value="image">이미지</option>
            <option value="video">비디오</option>
          </select>
          
          <select 
            value={filters.sortBy} 
            onChange={(e) => setFilters({
              ...filters, 
              sortBy: e.target.value as any
            })}
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="name">이름순</option>
            <option value="size">크기순</option>
          </select>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="empty-gallery">
          <div className="empty-icon">📷</div>
          <h3>업로드된 파일이 없습니다</h3>
          <p>파일을 업로드하여 갤러리를 채워보세요!</p>
        </div>
      ) : (
        <div className="gallery-content">
          {viewMode === 'grid' ? (
            groupDates.map(date => (
              <div key={date} className="date-group">
                <h3 className="date-header">{date}</h3>
                <div className="file-grid">
                  {fileGroups[date].map(file => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onClick={() => setSelectedFile(file)}
                      onDelete={() => handleDeleteFile(file.id)}
                      viewMode="grid"
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="file-list">
              <div className="list-header">
                <div className="list-col-name">이름</div>
                <div className="list-col-date">수정일</div>
                <div className="list-col-size">크기</div>
                <div className="list-col-actions"></div>
              </div>
              {files.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  onClick={() => setSelectedFile(file)}
                  onDelete={() => handleDeleteFile(file.id)}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedFile && (
        <FileViewer
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={() => {
            handleDeleteFile(selectedFile.id);
            setSelectedFile(null);
          }}
          onNext={() => {
            const currentIndex = files.findIndex(f => f.id === selectedFile.id);
            if (currentIndex < files.length - 1) {
              setSelectedFile(files[currentIndex + 1]);
            }
          }}
          onPrevious={() => {
            const currentIndex = files.findIndex(f => f.id === selectedFile.id);
            if (currentIndex > 0) {
              setSelectedFile(files[currentIndex - 1]);
            }
          }}
        />
      )}
    </div>
  );
};
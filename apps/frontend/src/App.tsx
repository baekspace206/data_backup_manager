import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/Upload/FileUpload';
import { FileGallery } from './components/Gallery/FileGallery';
import { ApiService } from './services/api';
import { FileStats } from './types/file';
import './App.css';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<FileStats | null>(null);

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
    loadStats();
  };

  const loadStats = async () => {
    try {
      const statsData = await ApiService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>💾 SaveMyData</h1>
          <p>개인용 홈 클라우드 - 사진과 비디오를 안전하게 백업하세요</p>
          
          {stats && (
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-value">{stats.totalFiles}</span>
                <span className="stat-label">파일</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{ApiService.formatFileSize(stats.totalSize)}</span>
                <span className="stat-label">용량</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.imageCount}</span>
                <span className="stat-label">이미지</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.videoCount}</span>
                <span className="stat-label">비디오</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <section className="upload-section">
          <FileUpload onUploadComplete={handleUploadComplete} />
        </section>

        <section className="gallery-section">
          <FileGallery refreshTrigger={refreshTrigger} />
        </section>
      </main>

      <footer className="app-footer">
        <p>SaveMyData v1.0 - 개인용 백업 솔루션</p>
      </footer>
    </div>
  );
}

export default App;
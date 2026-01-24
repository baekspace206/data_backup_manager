import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/Upload/FileUpload';
import { FileGallery } from './components/Gallery/FileGallery';
import { ApiService } from './services/api';
import { FileStats } from './types/file';
import './App.css';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'recent' | 'images' | 'videos'>('home');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
      {/* Modern Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">☁️</span>
            <span className="logo-text">SaveMyData</span>
          </div>
        </div>

        <div className="header-center">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="파일 검색..." />
          </div>
        </div>

        <div className="header-right">
          <div className="view-controls">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰
            </button>
          </div>
          <button className="upload-btn">+ 업로드</button>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-text">내 드라이브</span>
            </button>
            <button
              className={`nav-item ${currentView === 'recent' ? 'active' : ''}`}
              onClick={() => setCurrentView('recent')}
            >
              <span className="nav-icon">🕒</span>
              <span className="nav-text">최근 항목</span>
            </button>
            <button
              className={`nav-item ${currentView === 'images' ? 'active' : ''}`}
              onClick={() => setCurrentView('images')}
            >
              <span className="nav-icon">🖼️</span>
              <span className="nav-text">이미지</span>
            </button>
            <button
              className={`nav-item ${currentView === 'videos' ? 'active' : ''}`}
              onClick={() => setCurrentView('videos')}
            >
              <span className="nav-icon">🎬</span>
              <span className="nav-text">동영상</span>
            </button>
          </nav>

          {stats && (
            <div className="storage-info">
              <div className="storage-header">저장용량</div>
              <div className="storage-usage">
                <div className="usage-bar">
                  <div className="usage-fill" style={{ width: '35%' }}></div>
                </div>
                <div className="usage-text">
                  {ApiService.formatFileSize(stats.totalSize)} / 100GB 사용됨
                </div>
              </div>
              <div className="storage-details">
                <div className="detail-item">
                  <span className="detail-label">📁 파일 {stats.totalFiles}개</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">🖼️ 이미지 {stats.imageCount}개</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">🎬 동영상 {stats.videoCount}개</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="content-header">
            <h1 className="page-title">
              {currentView === 'home' && '내 드라이브'}
              {currentView === 'recent' && '최근 항목'}
              {currentView === 'images' && '이미지'}
              {currentView === 'videos' && '동영상'}
            </h1>
          </div>

          <div className="upload-section">
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>

          <div className="gallery-section">
            <FileGallery
              refreshTrigger={refreshTrigger}
              viewMode={viewMode}
              filterType={
                currentView === 'images' ? 'image' :
                currentView === 'videos' ? 'video' :
                undefined
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
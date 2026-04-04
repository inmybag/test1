'use client';

import { useState, useEffect } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight, Youtube, Instagram, Music, ExternalLink, X } from 'lucide-react';

export default function AnalysisPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    fetchResults();
  }, [category]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
      const catParam = category === 'All' ? '' : `&category=${category}`;
      const response = await fetch(`/api/analysis/results?date=${today}${catParam}`);
      const data = await response.json();
      setVideos(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return <Youtube size={16} color="#ef4444" />;
      case 'tiktok': return <Music size={16} color="#22d3ee" />;
      case 'instagram': return <Instagram size={16} color="#ec4899" />;
      default: return <Video size={16} color="#94a3b8" />;
    }
  };

  return (
    <main className="analysis-page">
      <div className="container">
        <header className="analysis-header">
          <div className="title-section">
            <h1 className="gradient-text">Daily AI Discovery</h1>
            <p className="subtitle">오늘의 뷰티 & 생활용품 트렌드 분석 리포트</p>
          </div>

          <nav className="category-nav">
            {['All', 'Beauty', 'Household'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`category-btn ${category === cat ? 'active' : ''}`}
              >
                {cat === 'All' ? '전체' : cat === 'Beauty' ? '뷰티' : '생활용품'}
              </button>
            ))}
          </nav>
        </header>

        {loading ? (
          <div className="loader-container">
            <div className="loader"></div>
            <p>인사이트를 추출하고 있습니다...</p>
          </div>
        ) : (
          <div className="analysis-grid">
            {videos.map((video) => (
              <div 
                key={video.videoId} 
                className="analysis-card"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="thumbnail-wrapper">
                  <img src={video.thumbnail} alt={video.title} className="thumbnail-img" />
                  <div className="card-badges">
                    <span className="category-badge">{video.category}</span>
                    <span className="platform-icon-wrapper">{getPlatformIcon(video.platform)}</span>
                  </div>
                  <div className="card-overlay">
                    <Play fill="white" size={48} />
                  </div>
                </div>
                <div className="card-content">
                  <h3 className="video-title">{video.title}</h3>
                  <div className="card-footer">
                    <span className="score-badge">Score {video.analysisJson.score}</span>
                    <span className="view-details">인사이트 보기 <ArrowRight size={14} /></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedVideo && (
          <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedVideo(null)}><X size={24} /></button>
              
              <div className="modal-flex">
                <div className="video-section">
                  <div className="player-wrapper">
                    <iframe 
                      src={selectedVideo.platform === 'youtube' 
                        ? `https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1` 
                        : selectedVideo.url}
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>

                <div className="insights-section">
                  <div className="insights-header">
                    <div className="platform-meta">
                      {getPlatformIcon(selectedVideo.platform)}
                      <span>{selectedVideo.platform.toUpperCase()}</span>
                    </div>
                    <div className="expert-badge">
                      <span>Success Score</span>
                      <strong className="score-num">{selectedVideo.analysisJson.score}</strong>
                    </div>
                  </div>

                  <div className="insights-body custom-scrollbar">
                    <h2 className="modal-title">{selectedVideo.title}</h2>
                    
                    <div className="analysis-block">
                      <div className="block-label blue">HOOK STRATEGY</div>
                      <blockquote className="hook-text">
                        "{selectedVideo.analysisJson.hook}"
                      </blockquote>
                    </div>
                    
                    <div className="analysis-block">
                      <div className="block-label purple">CONTENT ANALYSIS</div>
                      <p className="summary-text">{selectedVideo.analysisJson.summary}</p>
                    </div>
                    
                    <div className="analysis-block">
                      <div className="block-label green">SUCCESS TAKEAWAYS</div>
                      <div className="takeaways-list">
                        {selectedVideo.analysisJson.takeaways.map((item, idx) => (
                          <div key={idx} className="takeaway-item">
                            <span className="dot"></span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="insights-footer">
                    <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                      원본 영상 보기 <ExternalLink size={18} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .analysis-page {
          min-height: 100vh;
          padding-top: 8rem;
          padding-bottom: 4rem;
          background-color: #0a0a0c;
          color: #fff;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
        }
        .analysis-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5rem;
          gap: 2.5rem;
        }
        @media (min-width: 1024px) {
          .analysis-header { flex-direction: row; align-items: flex-end; }
        }
        .gradient-text {
          font-size: 3.5rem;
          font-weight: 900;
          margin-bottom: 0.75rem;
          background: linear-gradient(135deg, #60a5fa 0%, #a855f7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em;
        }
        .subtitle { color: #94a3b8; font-size: 1.25rem; font-weight: 400; }
        
        .category-nav {
          display: flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.5rem;
          border-radius: 1.5rem;
          backdrop-filter: blur(20px);
        }
        .category-btn {
          padding: 0.75rem 2rem;
          border-radius: 1rem;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .category-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .category-btn.active {
          background: #2563eb;
          color: #fff;
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
        }

        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
        }
        @media (min-width: 768px) { .analysis-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1100px) { .analysis-grid { grid-template-columns: repeat(3, 1fr); } }

        .analysis-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 2.5rem;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
          position: relative;
        }
        .analysis-card:hover {
          transform: translateY(-16px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.5);
        }
        
        .thumbnail-wrapper {
          position: relative;
          aspect-ratio: 9/16;
          overflow: hidden;
          background: #000;
        }
        .thumbnail-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 1.2s cubic-bezier(0.23, 1, 0.32, 1);
          opacity: 0.85;
        }
        .analysis-card:hover .thumbnail-img { transform: scale(1.1); opacity: 1; }
        
        .card-badges {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          right: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 5;
        }
        .category-badge {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
          padding: 0.5rem 1.25rem;
          border-radius: 99rem;
          font-size: 0.75rem;
          font-weight: 800;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          letter-spacing: 0.05em;
        }
        .platform-icon-wrapper {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
          padding: 0.6rem;
          border-radius: 1rem;
          display: flex;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .card-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.4s;
          z-index: 4;
        }
        .analysis-card:hover .card-overlay { opacity: 1; }

        .card-content { padding: 2rem; }
        .video-title {
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1.4;
          margin-bottom: 1.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          color: #f8fafc;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .score-badge {
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
          padding: 0.4rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.85rem;
          font-weight: 800;
          border: 1px solid rgba(37, 99, 235, 0.2);
        }
        .view-details { font-size: 0.9rem; color: #64748b; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
        .analysis-card:hover .view-details { color: #fff; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(12px);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
        .modal-container {
          position: relative;
          width: 100%;
          max-width: 1300px;
          height: 100%;
          max-height: 850px;
          background: #0a0a0c;
          border-radius: 3rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
          display: flex;
          box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.8);
        }
        .modal-close {
          position: absolute;
          top: 2rem;
          right: 2rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          cursor: pointer;
          z-index: 100;
          padding: 0.75rem;
          border-radius: 1.25rem;
          display: flex;
          transition: all 0.3s;
        }
        .modal-close:hover { background: rgba(255,255,255,0.15); transform: scale(1.1); }

        .modal-flex { display: flex; flex-direction: column; width: 100%; height: 100%; }
        @media (min-width: 1024px) { .modal-flex { flex-direction: row; } }

        .video-section {
          flex: 1;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 40%;
        }
        @media (min-width: 1024px) { .video-section { flex: 0 0 60%; min-height: 100%; } }

        .player-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .player-wrapper iframe {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          border: none;
        }

        .insights-section {
          width: 100%;
          background: #0a0a0c;
          display: flex;
          flex-direction: column;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        @media (min-width: 1024px) { .insights-section { width: 40%; border-top: none; border-left: 1px solid rgba(255, 255, 255, 0.1); } }

        .insights-header {
          padding: 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .platform-meta { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; font-weight: 900; color: #64748b; letter-spacing: 0.1em; }
        .expert-badge { display: flex; flex-direction: column; align-items: flex-end; }
        .expert-badge span { font-size: 0.7rem; color: #475569; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem; }
        .score-num { font-size: 2.5rem; color: #3b82f6; font-weight: 900; line-height: 1; }

        .insights-body {
          flex: 1;
          padding: 2.5rem;
          overflow-y: auto;
        }
        .modal-title { font-size: 1.75rem; font-weight: 900; margin-bottom: 3rem; line-height: 1.3; color: #fff; }

        .analysis-block { margin-bottom: 3.5rem; }
        .block-label { font-size: 0.7rem; font-weight: 900; letter-spacing: 0.2em; margin-bottom: 1.25rem; }
        .block-label.blue { color: #3b82f6; }
        .block-label.purple { color: #a855f7; }
        .block-label.green { color: #22c55e; }
        
        .hook-text { 
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 1.5rem;
          border-radius: 1.5rem;
          font-style: italic;
          color: #e2e8f0;
          line-height: 1.6;
          font-size: 1.1rem;
          margin: 0;
        }
        .summary-text { color: #94a3b8; line-height: 1.8; font-size: 1.05rem; }
        
        .takeaways-list { display: flex; flex-direction: column; gap: 1rem; }
        .takeaway-item { 
          display: flex; gap: 1.25rem; align-items: flex-start;
          background: rgba(255, 255, 255, 0.02);
          padding: 1.25rem;
          border-radius: 1rem;
          font-size: 1rem;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-top: 0.45rem; flex-shrink: 0; box-shadow: 0 0 12px #22c55e; }

        .insights-footer { padding: 2.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); }
        .btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 1rem;
          width: 100%; padding: 1.25rem; border-radius: 1.5rem;
          background: #fff; color: #000; font-weight: 800; text-decoration: none;
          transition: all 0.3s;
          font-size: 1.1rem;
        }
        .btn-primary:hover { background: #f1f5f9; transform: scale(1.02); }

        .loader-container { 
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 10rem 0; gap: 2rem; color: #475569;
        }
        .loader {
          width: 64px; height: 64px; border: 5px solid rgba(59, 130, 246, 0.1);
          border-top: 5px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </main>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight, Youtube, Instagram, Music, ExternalLink, X, Eye, Heart, MessageCircle, Lightbulb, TrendingUp, Sparkles, Share2 } from 'lucide-react';

export default function AnalysisPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [category, platform]);

  useEffect(() => {
    fetchResults();
  }, [category, platform, page]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      let queryParams = `?page=${page}&limit=12`;
      if (category !== 'All') queryParams += `&category=${category}`;
      if (platform !== 'All') queryParams += `&platform=${platform}`;
      
      const response = await fetch(`/api/analysis/results${queryParams}`);
      const data = await response.json();
      setVideos(data.results || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return <Youtube size={16} style={{ color: '#ef4444' }} />;
      case 'tiktok': return <Music size={16} style={{ color: '#22d3ee' }} />;
      case 'instagram': return <Instagram size={16} style={{ color: '#ec4899' }} />;
      default: return <Video size={16} style={{ color: '#94a3b8' }} />;
    }
  };


  const getEmbedUrl = (video) => {
    if (!video || !video.url) return '';
    const { videoId, url } = video;
    
    // YouTube (실제 YouTube URL이면 embed, 기존 fallback 데이터 포함)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = videoId;
      if (!id || id === 'undefined') {
        const match = url.match(/(?:shorts\/|v=|\/)([0-9A-Za-z_-]{11})/);
        id = match ? match[1] : '';
      }
      // 옛날 데이터를 위해 videoId 길이를 확인
      if (id.length < 11 && videoId && videoId.length >= 11) id = videoId;
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    }
    
    // TikTok 직접 URL
    if (url.includes('tiktok.com')) {
      let id = url.split('/').pop().split('?')[0];
      return `https://www.tiktok.com/embed/v2/${id}`;
    }
    
    // Instagram 직접 URL
    if (url.includes('instagram.com')) {
      let id = videoId;
      if (!id || id === 'undefined') {
        id = url.split('/reel/')[1]?.split('/')[0] || url.split('/p/')[1]?.split('/')[0];
      }
      return `https://www.instagram.com/p/${id}/embed/`;
    }
    
    return url;
  };


  const formatCount = (num) => {
    if (num === 0 || num === '0' || !num) return 'Analyzing';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const GaugeBar = ({ score }) => {
    const percentage = Math.min(Math.max(score, 0), 100);
    const color = percentage > 85 ? '#22c55e' : percentage > 70 ? '#3b82f6' : '#f59e0b';
    
    return (
      <div className="gauge-outer">
        <div className="gauge-inner" style={{ width: `${percentage}%`, backgroundColor: color }}>
          <div className="gauge-glow" style={{ backgroundColor: color }}></div>
        </div>
      </div>
    );
  };

  const renderPlanningContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} className="report-h2">{trimmed.replace('## ', '')}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={idx} className="report-h3">{trimmed.replace('### ', '')}</h3>;
      }
      if (trimmed.startsWith('- ')) {
        const content = trimmed.replace('- ', '');
        const parts = content.split('**');
        return (
          <div key={idx} className="report-list-item">
            <span className="bullet">•</span>
            <span>
              {parts.map((part, i) => (
                i % 2 === 1 ? <strong key={i} className="report-bold">{part}</strong> : part
              ))}
            </span>
          </div>
        );
      }
      if (trimmed.length === 0) return <div key={idx} className="report-spacing" />;
      
      const parts = line.split('**');
      return (
        <p key={idx} className="report-p">
          {parts.map((part, i) => (
            i % 2 === 1 ? <strong key={i} className="report-bold">{part}</strong> : part
          ))}
        </p>
      );
    });
  };

  return (
    <main className="analysis-page custom-scrollbar">
      <div className="hero-blob"></div>
      <div className="hero-blob-2"></div>
      
      <div className="container">
        <header className="analysis-header">
          <div className="title-section">
            <div className="badge-premium">
              <Sparkles size={14} /> AI DRIVEN CRAFT
            </div>
            <h1 className="gradient-text">Competitor Benchmarking</h1>
            <p className="subtitle">경쟁사 성과 분석 기반 애경산업 전문 크리에이티브 기획 제안</p>
          </div>

          <div className="filter-controls">
            <nav className="category-nav">
              {['All', 'Beauty', 'Household'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`category-btn ${category === cat ? 'active' : ''}`}
                >
                  {cat === 'All' ? '전체 카테고리' : cat === 'Beauty' ? '뷰티 경쟁사' : '생활용품 경쟁사'}
                </button>
              ))}
            </nav>
            <nav className="category-nav platform-nav">
              {['All', 'youtube', 'instagram', 'tiktok'].map(plat => (
                <button
                  key={plat}
                  onClick={() => setPlatform(plat)}
                  className={`category-btn ${platform === plat ? 'active' : ''}`}
                >
                  {plat === 'All' ? '전체 플랫폼' : plat === 'youtube' ? '유튜브' : plat === 'instagram' ? '인스타그램' : '틱톡'}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {loading ? (
          <div className="loader-container">
            <div className="loader-orbit">
              <div className="loader-planet"></div>
            </div>
            <p className="loading-text">인기 쇼츠의 성과 데이터를 정밀 분석 중입니다...</p>
          </div>
        ) : (
          <div className="analysis-grid">
            {videos.length > 0 ? videos.map((video) => (
              <div 
                key={video.videoId} 
                className={`analysis-card ${hoveredId === video.videoId ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredId(video.videoId)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedVideo(video)}
              >
                <div className="thumbnail-wrapper">
                  {video.thumbnail ? (
                    <img 
                      src={video.thumbnail} 
                      alt={video.title} 
                      className="thumbnail-img"
                      onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                    />
                  ) : null}
                  <div className="thumbnail-fallback" style={{ display: video.thumbnail ? 'none' : 'flex' }}>
                    <Video size={40} style={{ color: '#334155', opacity: 0.5 }} />
                  </div>
                  <div className="card-badges">

                    <span className="category-badge">{video.category}</span>
                    <span className="platform-icon-wrapper">{getPlatformIcon(video.platform)}</span>
                  </div>
                  <div className="play-overlay">
                    <div className="play-btn-circle">
                      <Play size={24} fill="white" />
                    </div>
                  </div>
                  <div className="metrics-overlay">
                    <div className="metric-item"><Eye size={12} /> {formatCount(video.viewCount)}</div>
                    <div className="metric-item"><Heart size={12} /> {formatCount(video.likeCount)}</div>
                  </div>
                </div>
                <div className="card-content">
                  <h3 className="video-title">{video.title}</h3>
                  <div className="card-footer">
                    <div className="performance-info">
                      <span className="score-label">벤치마킹 성공지수</span>
                      <div className="score-row">
                        <span className="score-value">{video.analysisJson.score}</span>
                        <TrendingUp size={16} className="text-blue-400" />
                      </div>
                    </div>
                    <button className="btn-view-report">
                      기획 리포트 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="empty-state">
                <Info size={48} />
                <p>해당 카테고리에 분석된 데이터가 아직 준비되지 않았습니다.</p>
                <button onClick={fetchResults} className="btn-retry">다시 시도</button>
              </div>
            )}
          </div>
        )}

        {!loading && videos.length > 0 && totalPages > 1 && (
          <div className="pagination">
            <button 
              className="page-btn" 
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
              disabled={page === 1}
            >
              이전
            </button>
            <div className="page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button 
                  key={p} 
                  className={`page-num ${page === p ? 'active' : ''}`}
                  onClick={() => { setPage(p); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
                >
                  {p}
                </button>
              ))}
            </div>
            <button 
              className="page-btn" 
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
              disabled={page === totalPages}
            >
              다음
            </button>
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
                      src={getEmbedUrl(selectedVideo)}
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      className="embed-frame"
                      key={selectedVideo.videoId}
                    ></iframe>
                    <div className="embed-fallback">
                      {selectedVideo.platform !== 'youtube' && (
                        <span className="platform-badge" style={{
                          background: selectedVideo.platform === 'tiktok' ? '#22d3ee22' : '#ec489922',
                          color: selectedVideo.platform === 'tiktok' ? '#22d3ee' : '#ec4899',
                          border: `1px solid ${selectedVideo.platform === 'tiktok' ? '#22d3ee44' : '#ec489944'}`,
                          padding: '0.3rem 0.8rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          letterSpacing: '0.1em',
                          marginBottom: '0.5rem',
                          display: 'inline-block',
                        }}>
                          {selectedVideo.platform.toUpperCase()} 레퍼런스 영상
                        </span>
                      )}
                      <p>재생이 안 되면 원본에서 확인하세요.</p>
                      <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer" className="btn-fallback">
                        원본에서 보기 <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>

                </div>

                <div className="insights-section">
                  <div className="insights-header">
                    <div className="platform-meta">
                      {getPlatformIcon(selectedVideo.platform)}
                      <span>{selectedVideo.platform.toUpperCase()} COMPETITOR BENCHMARKING</span>
                    </div>
                    <div className="engagement-stats">
                      <div className="stat" title="View Count">
                        <Eye size={14} /> <span>{formatCount(selectedVideo.viewCount)}</span>
                      </div>
                      <div className="stat" title="Like Count">
                        <Heart size={14} /> <span>{formatCount(selectedVideo.likeCount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="insights-body custom-scrollbar">
                    <h2 className="modal-title">{selectedVideo.title}</h2>
                    
                    <div className="analysis-block">
                      <div className="score-header">
                        <div className="block-label blue">SUCCESS FACTOR SCORE</div>
                        <span className="score-badge-large">{selectedVideo.analysisJson.score}</span>
                      </div>
                      <GaugeBar score={selectedVideo.analysisJson.score} />
                    </div>

                    <div className="analysis-block">
                      <div className="block-label cyan">COMPETITOR SUCCESS HACK</div>
                      <blockquote className="hook-text">
                        <span className="hook-label">[HOOK]</span> "{selectedVideo.analysisJson.hook}"
                        <div className="react-insight">
                          <Sparkles size={14} style={{ color: '#22d3ee' }} />
                          <span>{selectedVideo.analysisJson.commentInsight}</span>
                        </div>
                      </blockquote>
                    </div>

                    <div className="analysis-block">
                      <div className="block-label gold">AEKYUNG STRATEGIC PLANNING</div>
                      <div className="planning-box">
                        <div className="planning-header">
                          <Lightbulb size={20} style={{ color: '#facc15' }} />
                          <span>브랜드별 쇼츠 기획 리포트</span>
                        </div>
                        <div className="planning-content premium-report">
                          {renderPlanningContent(selectedVideo.analysisJson.planning) || <p>기획안을 생성 중입니다...</p>}
                        </div>
                      </div>
                    </div>

                    <div className="analysis-block">
                      <div className="block-label green">USER REACTIONS (TOP COMMENTS)</div>
                      <div className="comments-list">
                        {selectedVideo.comments && selectedVideo.comments.length > 0 ? (
                          selectedVideo.comments.map((c, idx) => (
                            <div key={idx} className="comment-item">
                              <p className="comment-text">"{c.text}"</p>
                              <div className="comment-meta">
                                <Heart size={10} /> <span>{c.like_count}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="no-data">댓글 반응 데이터가 없습니다.</p>
                        )}
                      </div>
                    </div>

                    <div className="analysis-block">
                      <div className="block-label purple">KEY PERFORMANCE TAKEAWAYS</div>
                      <div className="takeaways-list">
                        {selectedVideo.analysisJson.takeaways?.map((item, idx) => (
                          <div key={idx} className="takeaway-item">
                            <span className="takeaway-icon"><TrendingUp size={14} /></span>
                            <span>{item}</span>
                          </div>
                        )) || <p>데이터 로딩 중...</p>}
                      </div>
                    </div>
                  </div>

                  <div className="insights-footer">
                    <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                      원본 채널 방문하기 <ExternalLink size={18} />
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
          padding-top: 10rem;
          padding-bottom: 6rem;
          background-color: #050507;
          color: #fff;
          position: relative;
          overflow-x: hidden;
        }

        .hero-blob {
          position: absolute;
          top: -10%;
          right: -10%;
          width: 60%;
          height: 60%;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
          filter: blur(80px);
          z-index: 0;
          pointer-events: none;
        }

        .hero-blob-2 {
          position: absolute;
          bottom: -10%;
          left: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%);
          filter: blur(80px);
          z-index: 0;
          pointer-events: none;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          position: relative;
          z-index: 10;
        }

        .analysis-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 6rem;
          gap: 3rem;
        }
        @media (min-width: 1024px) {
          .analysis-header { flex-direction: row; align-items: flex-end; }
        }

        .filter-controls {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }
        @media (min-width: 1024px) { .filter-controls { align-items: flex-end; width: auto; } }

        .badge-premium {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.4rem 1rem;
          border-radius: 99rem;
          font-size: 0.7rem;
          font-weight: 800;
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 1.5rem;
          letter-spacing: 0.1em;
        }

        .gradient-text {
          font-size: 4.5rem;
          font-weight: 900;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #fff 30%, #3b82f6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        @media (max-width: 768px) {
          .gradient-text { font-size: 3rem; word-break: keep-all; }
        }
        
        .subtitle { color: #64748b; font-size: 1.25rem; font-weight: 400; max-width: 600px; line-height: 1.6; word-break: keep-all; }
        
        .category-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.4rem;
          border-radius: 1.2rem;
          backdrop-filter: blur(20px);
        }
        .platform-nav {
          background: rgba(59, 130, 246, 0.05);
        }
        
        .category-btn {
          padding: 0.8rem 1.5rem;
          border-radius: 0.9rem;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.95rem;
          white-space: nowrap;
          word-break: keep-all;
        }
        @media (min-width: 768px) { .category-btn { padding: 0.8rem 2.2rem; } }
        .category-btn:hover { color: #fff; background: rgba(255,255,255,0.03); }
        .category-btn.active {
          background: #3b82f6;
          color: #fff;
          box-shadow: 0 12px 30px -8px rgba(59, 130, 246, 0.5);
        }

        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
        }
        @media (min-width: 768px) { .analysis-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1200px) { .analysis-grid { grid-template-columns: repeat(3, 1fr); } }

        .analysis-card {
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 2.2rem;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .analysis-card:hover {
          transform: translateY(-20px) scale(1.02);
          background: #14141a;
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 130, 246, 0.1);
        }
        
        .thumbnail-wrapper {
          position: relative;
          aspect-ratio: 9/14;
          overflow: hidden;
          background: #0d0d10;
        }
        .thumbnail-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f0f14 0%, #1a1a24 100%);
        }
        .thumbnail-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1);
          filter: brightness(0.85);

        }
        .analysis-card:hover .thumbnail-img { transform: scale(1.15); filter: brightness(1.05); }
        
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 4rem;
          padding-bottom: 2rem;
        }
        .page-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 0.5rem 1.2rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .page-btn:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }
        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .page-numbers {
          display: flex;
          gap: 0.5rem;
        }
        .page-num {
          background: transparent;
          border: none;
          color: #94a3b8;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .page-num:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }
        .page-num.active {
          background: #3b82f6;
          color: #fff;
        }

        .play-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.2);
          opacity: 0;
          transition: opacity 0.4s;
          z-index: 3;
        }
        .analysis-card:hover .play-overlay { opacity: 1; }
        .play-btn-circle {
          width: 60px; height: 60px;
          background: rgba(59, 130, 246, 0.9);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(10px);
          transform: scale(0.8);
          transition: transform 0.4s;
        }
        .analysis-card:hover .play-btn-circle { transform: scale(1); }

        .metrics-overlay {
          position: absolute;
          bottom: 1.5rem;
          left: 1.5rem;
          display: flex;
          gap: 0.8rem;
          z-index: 5;
        }
        .metric-item {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          padding: 0.4rem 1rem;
          border-radius: 0.7rem;
          font-size: 0.75rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
        }

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
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          padding: 0.5rem 1.25rem;
          border-radius: 0.8rem;
          font-size: 0.75rem;
          font-weight: 800;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          letter-spacing: 0.02em;
        }
        .platform-icon-wrapper {
          background: #fff;
          padding: 0.6rem;
          border-radius: 1rem;
          display: flex;
          box-shadow: 0 8px 16px rgba(0,0,0,0.4);
        }

        .card-content { padding: 2.2rem; }
        .video-title {
          font-size: 1.35rem;
          font-weight: 800;
          line-height: 1.4;
          margin-bottom: 2rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          color: #f1f5f9;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 1.5rem;
        }
        .performance-info {
          display: flex;
          flex-direction: column;
        }
        .score-label { font-size: 0.7rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.3rem; letter-spacing: 0.05em; }
        .score-row { display: flex; align-items: center; gap: 0.5rem; }
        .score-value { font-size: 2rem; font-weight: 900; color: #3b82f6; line-height: 1; letter-spacing: -0.02em; }
        
        .btn-view-report {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          padding: 0.7rem 1.2rem;
          border-radius: 0.8rem;
          font-size: 0.85rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          transition: all 0.3s;
        }
        .analysis-card:hover .btn-view-report { background: #fff; color: #000; border-color: #fff; }

        /* Modal Design */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 2, 4, 0.9);
          backdrop-filter: blur(12px);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fadeIn 0.4s ease-out;
        }
        @media (min-width: 768px) {
          .modal-overlay { padding: 2rem; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-container {
          position: relative;
          width: 100%;
          max-width: 1400px;
          height: 95vh;
          background: #0a0a0c;
          border-radius: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: flex;
          box-shadow: 0 60px 120px -30px rgba(0, 0, 0, 0.9);
          animation: modalSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) {
          .modal-container { height: 90vh; border-radius: 2.5rem; }
        }
        @keyframes modalSlide { from { transform: scale(0.9) translateY(40px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          cursor: pointer;
          z-index: 100;
          padding: 0.6rem;
          border-radius: 1rem;
          display: flex;
          transition: all 0.3s;
        }
        @media (min-width: 768px) {
          .modal-close { top: 2rem; right: 2rem; padding: 0.8rem; border-radius: 1.2rem; }
        }
        .modal-close:hover { background: #ef4444; border-color: #ef4444; transform: rotate(90deg); }

        .modal-flex { display: flex; flex-direction: column; width: 100%; height: 100%; overflow-y: auto; }
        @media (min-width: 1024px) { .modal-flex { flex-direction: row; overflow-y: hidden; } }

        .video-section {
          flex: none;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 60vh;
          position: relative;
        }
        @media (min-width: 1024px) { .video-section { flex: 0 0 45%; height: 100%; } }

        .player-wrapper { width: 100%; height: 100%; position: relative; }
        .embed-frame { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        
        .embed-fallback {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          padding: 1rem 2rem;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          text-align: center;
          z-index: 10;
        }
        .embed-fallback p { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem; word-break: keep-all; }
        .btn-fallback { font-size: 0.9rem; font-weight: 800; color: #3b82f6; text-decoration: none; display: flex; align-items: center; gap: 0.5rem; justify-content: center; white-space: nowrap; }

        .insights-section {
          width: 100%;
          background: #0a0a0c;
          display: flex;
          flex-direction: column;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          flex: none;
        }
        @media (min-width: 1024px) { .insights-section { width: 55%; border-top: none; border-left: 1px solid rgba(255, 255, 255, 0.08); flex: 1; overflow: hidden; } }

        .insights-header {
          padding: 1.5rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        @media (min-width: 768px) {
          .insights-header { padding: 2.2rem 3rem; flex-direction: row; justify-content: space-between; align-items: center; gap: 0; }
        }
        
        .platform-meta { display: flex; align-items: center; gap: 1rem; font-size: 0.75rem; font-weight: 900; color: #475569; letter-spacing: 0.15em; word-break: keep-all; }
        .engagement-stats { display: flex; gap: 1rem; }
        @media (min-width: 768px) { .engagement-stats { gap: 2rem; } }
        
        .stat { display: flex; align-items: center; gap: 0.6rem; color: #94a3b8; font-size: 0.95rem; font-weight: 700; background: rgba(255,255,255,0.03); padding: 0.4rem 0.8rem; border-radius: 0.6rem; white-space: nowrap; }

        .insights-body { padding: 1.5rem; overflow-y: visible; flex: none; }
        @media (min-width: 768px) { .insights-body { padding: 3rem; } }
        @media (min-width: 1024px) { .insights-body { overflow-y: auto; flex: 1; } }
        .modal-title { font-size: 2rem; font-weight: 900; margin-bottom: 3.5rem; line-height: 1.3; color: #fff; letter-spacing: -0.02em; }

        .analysis-block { margin-bottom: 4rem; }
        .block-label { font-size: 0.75rem; font-weight: 900; letter-spacing: 0.25em; margin-bottom: 1.5rem; }
        .block-label.blue { color: #3b82f6; }
        .block-label.cyan { color: #22d3ee; }
        .block-label.gold { color: #eab308; }
        .block-label.purple { color: #a855f7; }
        
        .score-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem; }
        .score-badge-large { font-size: 2.5rem; font-weight: 950; color: #fff; line-height: 1; }

        .gauge-outer { width: 100%; height: 12px; background: rgba(255,255,255,0.05); border-radius: 99rem; overflow: hidden; position: relative; }
        .gauge-inner { height: 100%; border-radius: 99rem; transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative; }
        .gauge-glow { position: absolute; top: 0; right: 0; width: 40px; height: 100%; filter: blur(10px); opacity: 0.6; }

        .hook-text { 
          background: linear-gradient(to right, rgba(34, 211, 238, 0.05), transparent);
          border-left: 4px solid #22d3ee;
          padding: 2rem;
          border-radius: 0 1.5rem 1.5rem 0;
          color: #bae6fd;
          line-height: 1.7;
          font-size: 1.15rem;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .hook-label { font-size: 0.7rem; font-weight: 900; color: #22d3ee; opacity: 0.8; letter-spacing: 0.1em; }
        .react-insight { 
          display: flex; align-items: center; gap: 0.75rem; 
          font-size: 0.95rem; font-weight: 600; color: #fff;
          background: rgba(255,255,255,0.05); padding: 0.6rem 1rem; border-radius: 0.75rem;
          width: fit-content;
        }

        .planning-box {
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.05) 0%, rgba(13, 13, 16, 1) 100%);
          border: 1px solid rgba(234, 179, 8, 0.15);
          border-radius: 2rem;
          padding: 1.5rem;
        }
        @media (min-width: 768px) { .planning-box { padding: 2.5rem; } }
        .planning-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; color: #eab308; font-weight: 900; font-size: 1rem; letter-spacing: 0.1em; }
        .planning-content { color: #d1d5db; line-height: 1.8; font-size: 1rem; }
        @media (min-width: 768px) { .planning-content { font-size: 1.1rem; } }
        
        .premium-report { border-left: 2px solid rgba(234, 179, 8, 0.3); padding-left: 1.5rem; }
        
        .report-h2 { 
          font-size: 1.6rem; font-weight: 950; color: #fff; margin: 3rem 0 1.5rem 0; 
          background: linear-gradient(to right, #fff, rgba(255,255,255,0.4));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em;
        }
        .report-h2:first-of-type { margin-top: 0; }
        
        .report-h3 { 
          font-size: 1.15rem; font-weight: 800; color: #facc15; margin: 2rem 0 1rem 0; 
          padding: 0.6rem 1.2rem; background: rgba(250, 204, 21, 0.1); border-radius: 0.8rem;
          width: fit-content;
          border: 1px solid rgba(250, 204, 21, 0.2);
        }
        
        .report-p { margin-bottom: 1rem; color: #94a3b8; }
        .report-list-item { display: flex; gap: 0.75rem; margin-bottom: 0.8rem; align-items: flex-start; color: #cbd5e1; }
        .bullet { color: #eab308; font-weight: 900; }
        .report-bold { color: #fff; font-weight: 800; text-decoration: underline decoration-rgba(234, 179, 8, 0.3) underline-offset-4; }
        .report-spacing { height: 1.5rem; }
        
        .comments-list { display: flex; flex-direction: column; gap: 1rem; }
        .comment-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 1.25rem 1.5rem;
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .comment-text { font-size: 0.95rem; color: #cbd5e1; font-style: italic; margin: 0; }
        .comment-meta { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #ef4444; font-weight: 700; }
        .no-data { color: #475569; font-size: 0.9rem; text-align: center; padding: 2rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 1rem; }

        .takeaways-list { display: flex; flex-direction: column; gap: 1.2rem; }
        .takeaway-item { 
          display: flex; gap: 1.5rem; align-items: center;
          background: rgba(255, 255, 255, 0.02);
          padding: 1.5rem 2rem;
          border-radius: 1.2rem;
          font-size: 1.05rem;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: transform 0.3s;
        }
        .takeaway-item:hover { transform: translateX(10px); border-color: rgba(168, 85, 247, 0.3); }
        .takeaway-icon { color: #a855f7; display: flex; }

        .insights-footer { padding: 3rem; border-top: 1px solid rgba(255, 255, 255, 0.08); }
        .btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 1rem;
          width: 100%; padding: 1.5rem; border-radius: 1.5rem;
          background: #fff; color: #000; font-weight: 800; text-decoration: none;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          font-size: 1.1rem;
          box-shadow: 0 20px 40px -10px rgba(255,255,255,0.2);
        }
        .btn-primary:hover { transform: translateY(-5px); box-shadow: 0 30px 50px -10px rgba(255,255,255,0.3); }

        /* Loaders & Empty states */
        .loader-container { 
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 15rem 0; gap: 3rem;
        }
        .loader-orbit {
          width: 80px; height: 80px;
          border: 2px solid rgba(59, 130, 246, 0.1);
          border-radius: 50%;
          position: relative;
          animation: rotate 2s linear infinite;
        }
        .loader-planet {
          width: 16px; height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          position: absolute;
          top: -8px; left: 32px;
          box-shadow: 0 0 20px #3b82f6;
        }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .loading-text { color: #64748b; font-size: 1.1rem; font-weight: 500; letter-spacing: 0.02em; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10rem 0; gap: 2rem; color: #475569; }
        .btn-retry { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 0.7rem 2rem; border-radius: 0.7rem; cursor: pointer; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
      `}</style>
    </main>
  );
}

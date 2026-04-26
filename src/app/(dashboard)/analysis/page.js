'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight, Youtube, Instagram, Music, ExternalLink, X, Eye, Heart, MessageCircle, Lightbulb, TrendingUp, Sparkles, Share2, CheckCircle } from 'lucide-react';

export default function AnalysisPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const [category, setCategory] = useState('All');
  const [platform, setPlatform] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [isSendingToNotion, setIsSendingToNotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      setShowTopButton(scrollPos > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (selectedVideo && selectedVideo.notionUrl) {
      validateNotionPage(selectedVideo);
    }
  }, [selectedVideo]);

  const validateNotionPage = async (video) => {
    try {
      const response = await fetch('/api/notion/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          dateStr: video.dateStr,
          notionUrl: video.notionUrl
        })
      });
      const result = await response.json();
      if (!result.isValid) {
        video.notionUrl = null;
        setSelectedVideo({ ...video }); 
      }
    } catch (error) {
      console.error('Failed to validate notion page:', error);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [category, platform]);

  const fetchResults = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    
    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      let queryParams = `?page=${currentPage}&limit=24`;
      if (category !== 'All') queryParams += `&category=${category}`;
      if (platform !== 'All') queryParams += `&platform=${platform}`;
      
      const response = await fetch(`/api/analysis/results${queryParams}`);
      const data = await response.json();
      
      const newVideos = data.results || [];
      if (isLoadMore) {
        setVideos(prev => {
          const combined = [...prev, ...newVideos];
          const uniqueMap = new Map();
          combined.forEach(video => {
            if (video.videoId) uniqueMap.set(video.videoId, video);
          });
          const result = Array.from(uniqueMap.values());
          extractTags(result);
          return result;
        });
        setPage(currentPage);
      } else {
        setVideos(newVideos);
        extractTags(newVideos);
        setPage(1);
      }

      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const extractTags = (videoList) => {
    const tags = new Set();
    videoList.forEach(v => {
      if (v.analysisJson && v.analysisJson.tags) {
        v.analysisJson.tags.forEach(t => tags.add(t));
      }
    });
    setAvailableTags(Array.from(tags).sort());
  };

  const filteredVideos = selectedTag === 'All' 
    ? videos 
    : videos.filter(v => v.analysisJson?.tags?.includes(selectedTag));

  const sendToNotion = async (video) => {
    if (isSendingToNotion) return;
    setIsSendingToNotion(true);

    try {
      const response = await fetch('/api/notion/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          platform: video.platform,
          category: video.category,
          score: video.analysisJson.score,
          hook: video.analysisJson.hook,
          commentInsight: video.analysisJson.commentInsight,
          planning: video.analysisJson.planning,
          url: video.url,
          thumbnail: video.thumbnail,
          videoId: video.videoId,
          dateStr: video.dateStr
        })
      });

      const result = await response.json();
      if (result.success) {
        video.isSentToNotion = true;
        video.notionUrl = result.url;
        setVideos(prev => [...prev]);
        alert('🚀 마케팅부문 노션 페이지로 성공적으로 전송되었습니다!');
      } else {
        alert('❌ 노션 전송 중 오류가 발생했습니다: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('❌ 서버 연결에 실패했습니다.');
    } finally {
      setIsSendingToNotion(false);
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
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    }
    if (url.includes('tiktok.com')) {
      const id = url.split('/').pop().split('?')[0];
      return `https://www.tiktok.com/embed/v2/${id}`;
    }
    if (url.includes('instagram.com')) {
      return `https://www.instagram.com/p/${videoId}/embed/`;
    }
    return url;
  };

  const formatCount = (num) => {
    if (!num || num === 0) return 'Analyzing';
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
    const result = [];
    let tableRows = [];
    let isTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.includes('---')) continue;
        isTable = true;
        tableRows.push(line.split('|').slice(1, -1).map(c => c.trim()));
        continue;
      } else if (isTable) {
        if (tableRows.length > 0) {
          result.push(
            <div key={`table-${i}`} className="report-table-wrapper">
              <table className="report-table">
                <thead><tr>{tableRows[0].map((cell, idx) => <th key={idx}>{cell}</th>)}</tr></thead>
                <tbody>{tableRows.slice(1).map((row, rIdx) => (<tr key={rIdx}>{row.map((cell, cIdx) => <td key={cIdx}>{cell}</td>)}</tr>))}</tbody>
              </table>
            </div>
          );
        }
        tableRows = []; isTable = false;
      }
      if (line.startsWith('## ')) result.push(<h2 key={i} className="report-h2">{line.replace('## ', '')}</h2>);
      else if (line.startsWith('### ')) result.push(<h3 key={i} className="report-h3">{line.replace('### ', '')}</h3>);
      else if (line.startsWith('- ')) {
        const parts = line.replace('- ', '').split('**');
        result.push(<div key={i} className="report-list-item"><span className="bullet">•</span><span>{parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="report-bold">{part}</strong> : part))}</span></div>);
      } else if (line.length > 0) {
        const parts = line.split('**');
        result.push(<p key={i} className="report-p">{parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="report-bold">{part}</strong> : part))}</p>);
      } else result.push(<div key={i} className="report-spacing" />);
    }
    return result;
  };

  if (!mounted) return <main className="analysis-page" style={{ opacity: 0 }} suppressHydrationWarning={true}><div className="container"></div></main>;

  return (
    <main className="analysis-page custom-scrollbar" suppressHydrationWarning={true}>
      <div className="hero-blob"></div>
      <div className="hero-blob-2"></div>
      
      <div className="container">
        <header className="analysis-header">
          <div className="title-section">
            <div className="badge-premium"><Sparkles size={14} /> AI DRIVEN CRAFT</div>
            <h1 className="gradient-text">Competitor Benchmarking</h1>
            <p className="subtitle">경쟁사 성과 분석 기반 애경산업 전문 크리에이티브 기획 제안</p>
          </div>

          <div className="filter-controls">
            <nav className="category-nav">
              {['All', 'Beauty', 'Household'].map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} className={`category-btn ${category === cat ? 'active' : ''}`}>
                  {cat === 'All' ? '전체 카테고리' : cat === 'Beauty' ? '뷰티 경쟁사' : '생활용품 경쟁사'}
                </button>
              ))}
            </nav>
            <nav className="platform-nav">
              {[
                { id: 'All', label: '전체 플랫폼', icon: <Sparkles size={14} /> },
                { id: 'youtube', label: '유튜브', icon: <Youtube size={14} /> },
                { id: 'instagram', label: '인스타그램', icon: <Instagram size={14} /> },
                { id: 'tiktok', label: '틱톡', icon: <Music size={14} /> }
              ].map(plat => (
                <button key={plat.id} onClick={() => setPlatform(plat.id)} className={`platform-btn ${platform === plat.id ? 'active' : ''} ${plat.id}`}>
                  {plat.icon}<span>{plat.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        <section className="tag-navigation-section">
          <div className="tag-cloud">
            <button className={`tag-btn ${selectedTag === 'All' ? 'active' : ''}`} onClick={() => setSelectedTag('All')}>#전체보기</button>
            {availableTags.map(tag => (
              <button key={tag} className={`tag-btn ${selectedTag === tag ? 'active' : ''}`} onClick={() => setSelectedTag(tag)}>{tag}</button>
            ))}
          </div>
        </section>

        {loading && !loadingMore ? (
          <div className="loader-container">
            <div className="loader-orbit"><div className="loader-planet"></div></div>
            <p className="loading-text">인기 성과 데이터를 분석 중입니다...</p>
          </div>
        ) : (
          <>
            <div className="analysis-grid">
              {filteredVideos.length > 0 ? filteredVideos.map((video) => (
                <div key={video.videoId} className={`analysis-card ${hoveredId === video.videoId ? 'hovered' : ''}`} onMouseEnter={() => setHoveredId(video.videoId)} onMouseLeave={() => setHoveredId(null)} onClick={() => setSelectedVideo(video)}>
                  <div className="thumbnail-wrapper">
                    {video.thumbnail ? (
                      <img 
                        src={video.thumbnail} alt={video.title} className="thumbnail-img" loading="lazy" referrerPolicy="no-referrer"
                        onError={(e) => { 
                          if (e.target.src.includes('maxresdefault')) e.target.src = e.target.src.replace('maxresdefault.webp', 'hqdefault.jpg').replace('maxresdefault.jpg', 'hqdefault.jpg');
                          else { e.target.style.display='none'; const fallback = e.target.nextSibling; if (fallback) fallback.style.display='flex'; }
                        }}
                      />
                    ) : null}
                    <div className="thumbnail-fallback" style={{ display: video.thumbnail ? 'none' : 'flex' }}><div className="fallback-inner"><Video size={48} style={{ color: '#475569', opacity: 0.4 }} /><span className="fallback-text">미리보기 준비 중</span></div></div>
                    <div className="card-badges">
                      <span className="category-badge">{video.category}</span>
                      <div className="badge-group">
                        {video.dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '') && <span className="today-badge"><Sparkles size={12} /><span>오늘 신규</span></span>}
                        {video.isSentToNotion && <span className="notion-sent-badge"><CheckCircle size={12} /><span>전송됨</span></span>}
                        <span className="platform-icon-wrapper">{getPlatformIcon(video.platform)}</span>
                      </div>
                    </div>
                    <div className="play-overlay"><div className="play-btn-circle"><Play size={24} fill="white" /></div></div>
                    <div className="metrics-overlay"><div className="metric-item"><Eye size={12} /> {formatCount(video.viewCount)}</div><div className="metric-item"><Heart size={12} /> {formatCount(video.likeCount)}</div></div>
                  </div>
                  <div className="card-content">
                    <h3 className="video-title">{video.title}</h3>
                    <div className="card-tags">{video.analysisJson?.tags?.slice(0, 3).map((tag, idx) => (<span key={idx} className="card-tag">{tag}</span>))}</div>
                    <div className="card-footer">
                      <div className="performance-info">
                        <span className="score-label">벤치마킹 성공지수</span>
                        <div className="score-row"><span className="score-value">{video.analysisJson.score}</span><TrendingUp size={16} className="text-blue-400" /></div>
                        <span className="date-info">수집일: {video.dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</span>
                      </div>
                      <button className="btn-view-report">기획 리포트 <ArrowRight size={14} /></button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="empty-state"><Info size={48} /><p>해당 조건에 분석된 데이터가 아직 준비되지 않았습니다.</p><button onClick={() => { setCategory('All'); setPlatform('All'); setSelectedTag('All'); fetchResults(); }} className="btn-retry">필터 초기화</button></div>
              )}
            </div>
            {loadingMore && <div className="load-more-spinner"><div className="mini-spinner"></div><span>데이터 추가 분석 중...</span></div>}
            {!loading && videos.length > 0 && page < totalPages && selectedTag === 'All' && (
              <div className="pagination">
                <button className="btn-load-more" onClick={() => fetchResults(true)} disabled={loadingMore}>
                  {loadingMore ? '분석 데이터 불러오는 중...' : `영상 더 불러오기 (전체 ${totalPages}페이지 중 ${page}페이지)`} 
                  {!loadingMore && <ArrowRight size={18} />}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedVideo && (
        <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedVideo(null)}><X size={24} /></button>
            <div className="modal-flex">
              <div className="video-section">
                <div className="player-wrapper">
                  <iframe src={getEmbedUrl(selectedVideo)} allow="autoplay; fullscreen" allowFullScreen className="embed-frame" key={selectedVideo.videoId}></iframe>
                </div>
              </div>
              <div className="insights-section">
                <div className="insights-header">
                  <div className="platform-meta">{getPlatformIcon(selectedVideo.platform)}<span>{selectedVideo.platform.toUpperCase()} COMPETITOR BENCHMARKING</span></div>
                  <div className="engagement-stats">
                    <div className="stat"><Eye size={14} /> <span>{formatCount(selectedVideo.viewCount)}</span></div>
                    <div className="stat"><Heart size={14} /> <span>{formatCount(selectedVideo.likeCount)}</span></div>
                  </div>
                </div>
                <div className="insights-body custom-scrollbar">
                  <h2 className="modal-title">{selectedVideo.title}</h2>
                  <div className="analysis-block">
                    <div className="score-header"><div className="block-label blue">SUCCESS FACTOR SCORE</div><span className="score-badge-large">{selectedVideo.analysisJson.score}</span></div>
                    <GaugeBar score={selectedVideo.analysisJson.score} />
                  </div>
                  <div className="analysis-block">
                    <div className="block-label cyan">COMPETITOR SUCCESS HACK</div>
                    <blockquote className="hook-text">
                      <span className="hook-label">[HOOK]</span> "{selectedVideo.analysisJson.hook}"
                      <div className="react-insight"><Sparkles size={14} style={{ color: '#22d3ee' }} /><span>{selectedVideo.analysisJson.commentInsight}</span></div>
                    </blockquote>
                  </div>
                  <div className="analysis-block">
                    <div className="block-label gold">AEKYUNG STRATEGIC PLANNING</div>
                    <div className="planning-box">
                      <div className="planning-content premium-report">
                        {renderPlanningContent(selectedVideo.analysisJson.planning) || <p>기획안 로딩 중...</p>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="insights-footer">
                  <div className="footer-actions">
                    <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer" className="btn-visit">원본 채널 방문 <ExternalLink size={16} /></a>
                    {selectedVideo.isSentToNotion || selectedVideo.notionUrl ? (
                      <a href={selectedVideo.notionUrl} target="_blank" rel="noopener noreferrer" className="btn-notion success">노션 페이지 확인하기 <ArrowRight size={16} /></a>
                    ) : (
                      <button onClick={() => sendToNotion(selectedVideo)} className={`btn-notion ${isSendingToNotion ? 'loading' : ''}`} disabled={isSendingToNotion}>
                        {isSendingToNotion ? '노션으로 전송 중...' : '노션 페이지로 보내기'}{!isSendingToNotion && <Share2 size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTopButton && (
        <button className="btn-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <TrendingUp size={24} style={{ transform: 'rotate(-90deg)' }} />
          <span>TOP</span>
        </button>
      )}

      <style jsx>{`
        .analysis-page { min-height: 100vh; padding-top: 10rem; padding-bottom: 3rem; background-color: #050507; color: #fff; position: relative; }
        .hero-blob { position: absolute; top: -10%; right: -10%; width: 60%; height: 60%; background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%); filter: blur(80px); z-index: 0; pointer-events: none; }
        .hero-blob-2 { position: absolute; bottom: -10%; left: -10%; width: 50%; height: 50%; background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%); filter: blur(80px); z-index: 0; pointer-events: none; }
        .container { max-width: 1400px; margin: 0 auto; padding: 0 2rem; position: relative; z-index: 10; }
        .analysis-header { display: flex; flex-direction: column; gap: 3rem; margin-bottom: 6rem; }
        @media (min-width: 1024px) { .analysis-header { flex-direction: row; align-items: flex-end; justify-content: space-between; } }
        .gradient-text { font-size: 4.5rem; font-weight: 900; background: linear-gradient(135deg, #fff 30%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { color: #64748b; font-size: 1.25rem; }
        .tag-navigation-section { margin-bottom: 4rem; padding: 1.5rem; background: rgba(255, 255, 255, 0.02); border-radius: 1.5rem; }
        .tag-cloud { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
        .tag-btn { padding: 0.5rem 1rem; border-radius: 99rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #94a3b8; cursor: pointer; }
        .tag-btn.active { background: #3b82f633; border-color: #3b82f688; color: #60a5fa; }
        .analysis-grid { display: grid; gap: 3rem; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); }
        .analysis-card { background: #0d0d10; border-radius: 2.2rem; cursor: pointer; transition: all 0.4s; overflow: hidden; }
        .analysis-card:hover { transform: translateY(-10px); background: #14141a; }
        .thumbnail-wrapper { aspect-ratio: 9/16; position: relative; overflow: hidden; }
        .thumbnail-img { width: 100%; height: 100%; object-fit: cover; }
        .card-badges { position: absolute; top: 1.5rem; left: 1.5rem; right: 1.5rem; display: flex; justify-content: space-between; }
        .category-badge { background: rgba(0,0,0,0.5); padding: 0.4rem 1rem; border-radius: 0.5rem; font-size: 0.75rem; }
        .metrics-overlay { position: absolute; bottom: 1rem; left: 1rem; display: flex; gap: 0.5rem; }
        .metric-item { background: rgba(0,0,0,0.6); padding: 0.3rem 0.6rem; border-radius: 0.4rem; font-size: 0.7rem; display: flex; align-items: center; gap: 0.3rem; }
        .card-content { padding: 1.5rem; }
        .video-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; height: 3rem; overflow: hidden; }
        .card-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
        .card-tag { font-size: 0.7rem; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 0.2rem 0.5rem; border-radius: 0.3rem; }
        .score-value { font-size: 1.5rem; font-weight: 900; color: #3b82f6; }
        .pagination { display: flex; justify-content: center; margin-top: 4rem; }
        .btn-load-more { padding: 1rem 3rem; border-radius: 1rem; background: #1e293b; color: #fff; cursor: pointer; border: 1px solid #334155; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-container { width: 95%; max-width: 1200px; height: 90vh; background: #0d0d10; border-radius: 2rem; display: flex; overflow: hidden; position: relative; }
        .modal-flex { display: flex; width: 100%; height: 100%; }
        .video-section { flex: 1; background: #000; }
        .insights-section { flex: 0.8; padding: 2rem; overflow-y: auto; display: flex; flex-direction: column; }
        .player-wrapper { width: 100%; height: 100%; }
        .embed-frame { width: 100%; height: 100%; border: none; }
        .btn-top { position: fixed; bottom: 2rem; right: 2rem; width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #fff; color: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; z-index: 1000; border: none; font-weight: 900; }
        .page-premium { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255, 255, 255, 0.05); padding: 0.4rem 1rem; border-radius: 99rem; font-size: 0.7rem; font-weight: 800; color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 1.5rem; letter-spacing: 0.1em; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </main>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight, Youtube, Instagram, Music, ExternalLink, X, Eye, Heart, MessageCircle, Lightbulb, TrendingUp, Sparkles, Share2, CheckCircle } from 'lucide-react';

export default function AnalysisPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
          score: video.analysisJson?.score || 0,
          hook: video.analysisJson?.hook || '',
          commentInsight: video.analysisJson?.commentInsight || '',
          planning: video.analysisJson?.planning || '',
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
                        <div className="score-row"><span className="score-value">{video.analysisJson?.score || 0}</span><TrendingUp size={16} className="text-blue-400" /></div>
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
                    <div className="score-header"><div className="block-label blue">SUCCESS FACTOR SCORE</div><span className="score-badge-large">{selectedVideo.analysisJson?.score || 0}</span></div>
                    <GaugeBar score={selectedVideo.analysisJson?.score || 0} />
                  </div>
                  <div className="analysis-block">
                    <div className="block-label cyan">COMPETITOR SUCCESS HACK</div>
                    <blockquote className="hook-text">
                      <span className="hook-label">[HOOK]</span> "{selectedVideo.analysisJson?.hook || '분석된 훅이 없습니다.'}"
                      <div className="react-insight"><Sparkles size={14} style={{ color: '#22d3ee' }} /><span>{selectedVideo.analysisJson?.commentInsight || '댓글 인사이트가 없습니다.'}</span></div>
                    </blockquote>
                  </div>
                  <div className="analysis-block">
                    <div className="block-label gold">AEKYUNG STRATEGIC PLANNING</div>
                    <div className="planning-box">
                      <div className="planning-content premium-report">
                        {renderPlanningContent(selectedVideo.analysisJson?.planning) || <p>기획안 로딩 중...</p>}
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



      <style jsx>{`
        .analysis-page { padding-top: 10rem; padding-bottom: 2rem; background-color: #050507; color: #fff; position: relative; }
        .hero-blob { position: absolute; top: -10%; right: -10%; width: 60%; height: 60%; background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%); filter: blur(80px); z-index: 0; pointer-events: none; }
        .hero-blob-2 { position: absolute; bottom: 0; left: -10%; width: 50%; height: 50%; background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%); filter: blur(80px); z-index: 0; pointer-events: none; }
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
        .analysis-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 2.2rem; cursor: pointer; transition: all 0.4s; overflow: hidden; }
        .analysis-card:hover { transform: translateY(-10px); background: rgba(255,255,255,0.07); border-color: rgba(59,130,246,0.4); box-shadow: 0 20px 60px rgba(59,130,246,0.1); }
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

        /* 카드 하단 영역 */
        .card-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06); }
        .performance-info { display: flex; flex-direction: column; gap: 0.25rem; }
        .score-label { font-size: 0.7rem; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .score-row { display: flex; align-items: center; gap: 0.4rem; }
        .date-info { font-size: 0.7rem; color: #475569; }
        .btn-view-report { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 0.75rem; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.2); color: #60a5fa; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .btn-view-report:hover { background: rgba(59,130,246,0.22); }

        /* 배지 */
        .badge-premium { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.4rem 1rem; border-radius: 99rem; font-size: 0.72rem; font-weight: 800; color: #64748b; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 1.5rem; letter-spacing: 0.1em; }
        .badge-group { display: flex; align-items: center; gap: 0.4rem; }
        .today-badge { display: flex; align-items: center; gap: 0.3rem; background: rgba(251,191,36,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); padding: 0.25rem 0.6rem; border-radius: 0.4rem; font-size: 0.65rem; font-weight: 700; }
        .notion-sent-badge { display: flex; align-items: center; gap: 0.3rem; background: rgba(157,206,99,0.15); color: #9dce63; border: 1px solid rgba(157,206,99,0.3); padding: 0.25rem 0.6rem; border-radius: 0.4rem; font-size: 0.65rem; font-weight: 700; }
        .platform-icon-wrapper { display: flex; align-items: center; background: rgba(0,0,0,0.4); padding: 0.3rem; border-radius: 0.4rem; }
        .play-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0); transition: background 0.3s; }
        .analysis-card:hover .play-overlay { background: rgba(0,0,0,0.35); }
        .play-btn-circle { width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); border: 2px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; }
        .analysis-card:hover .play-btn-circle { opacity: 1; }

        /* 빈 상태 & 로더 */
        .loader-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8rem 0; gap: 1.5rem; color: #475569; }
        .loader-orbit { width: 60px; height: 60px; border: 3px solid rgba(59,130,246,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin-orbit 1s linear infinite; }
        .loader-planet { position: absolute; }
        @keyframes spin-orbit { to { transform: rotate(360deg); } }
        .loading-text { font-size: 1rem; color: #475569; font-weight: 500; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8rem 0; gap: 1.5rem; color: #475569; text-align: center; grid-column: 1 / -1; }
        .btn-retry { padding: 0.75rem 2rem; border-radius: 1rem; background: #1e293b; border: 1px solid #334155; color: #94a3b8; font-weight: 600; cursor: pointer; }
        .load-more-spinner { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 2rem; color: #475569; }
        .mini-spinner { width: 20px; height: 20px; border: 2px solid rgba(59,130,246,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin-orbit 0.8s linear infinite; }

        /* 모달 내부 */
        .modal-close { position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.08); border: none; color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; transition: background 0.2s; }
        .modal-close:hover { background: rgba(239,68,68,0.2); color: #f87171; }
        .insights-header { padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 1.5rem; }
        .platform-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 800; color: #475569; letter-spacing: 0.08em; margin-bottom: 0.75rem; }
        .engagement-stats { display: flex; gap: 1rem; }
        .stat { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #64748b; }
        .insights-body { flex: 1; overflow-y: auto; padding-right: 0.5rem; }
        .insights-footer { padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 1rem; }
        .footer-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .btn-visit { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.25rem; border-radius: 0.75rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: 600; font-size: 0.875rem; text-decoration: none; transition: background 0.2s; }
        .btn-visit:hover { background: rgba(255,255,255,0.1); }
        .btn-notion { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.25rem; border-radius: 0.75rem; background: #3b82f6; border: none; color: #fff; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: background 0.2s; text-decoration: none; }
        .btn-notion:hover { background: #2563eb; }
        .btn-notion.success { background: rgba(157,206,99,0.15); border: 1px solid rgba(157,206,99,0.3); color: #9dce63; }
        .btn-notion.loading { opacity: 0.6; cursor: not-allowed; }
        .modal-title { font-size: 1.2rem; font-weight: 800; margin-bottom: 1.5rem; line-height: 1.4; }

        /* 분석 블록 */
        .analysis-block { margin-bottom: 1.75rem; }
        .block-label { font-size: 0.65rem; font-weight: 900; letter-spacing: 0.12em; margin-bottom: 1rem; display: inline-block; }
        .block-label.blue { color: #3b82f6; }
        .block-label.cyan { color: #22d3ee; }
        .block-label.gold { color: #f59e0b; }
        .score-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .score-badge-large { font-size: 2.5rem; font-weight: 900; color: #3b82f6; }
        .gauge-outer { width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .gauge-inner { height: 100%; border-radius: 4px; position: relative; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .gauge-glow { position: absolute; right: 0; top: -4px; width: 16px; height: 16px; border-radius: 50%; opacity: 0.6; filter: blur(4px); }
        .hook-text { border-left: 3px solid #22d3ee; padding-left: 1rem; margin: 0; font-size: 0.95rem; line-height: 1.7; color: #e2e8f0; font-style: italic; }
        .hook-label { color: #22d3ee; font-weight: 800; font-style: normal; font-size: 0.75rem; }
        .react-insight { display: flex; align-items: flex-start; gap: 0.5rem; margin-top: 0.75rem; color: #64748b; font-size: 0.85rem; font-style: normal; }
        .planning-box { background: rgba(245,158,11,0.04); border: 1px solid rgba(245,158,11,0.12); border-radius: 1rem; padding: 1.5rem; margin-top: 0.5rem; }
        .planning-content { font-size: 0.9rem; line-height: 1.8; color: #cbd5e1; }
        .report-h2 { font-size: 1.1rem; font-weight: 800; color: #f1f5f9; margin: 1.5rem 0 0.75rem; }
        .report-h3 { font-size: 0.95rem; font-weight: 700; color: #94a3b8; margin: 1.25rem 0 0.5rem; }
        .report-p { margin: 0.5rem 0; color: #94a3b8; }
        .report-list-item { display: flex; gap: 0.5rem; margin: 0.35rem 0; color: #94a3b8; }
        .bullet { color: #f59e0b; flex-shrink: 0; }
        .report-bold { color: #e2e8f0; font-weight: 700; }
        .report-spacing { height: 0.75rem; }
        .report-table-wrapper { overflow-x: auto; margin: 1rem 0; }
        .report-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .report-table th { background: rgba(245,158,11,0.1); color: #f59e0b; padding: 0.5rem 0.75rem; text-align: left; font-weight: 700; }
        .report-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: #94a3b8; }

        .pagination { display: flex; justify-content: center; margin-top: 4rem; }
        .btn-load-more { padding: 1rem 3rem; border-radius: 1rem; background: #1e293b; color: #fff; cursor: pointer; border: 1px solid #334155; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-container { width: 95%; max-width: 1200px; height: 90vh; background: #0d0d10; border-radius: 2rem; display: flex; overflow: hidden; position: relative; }
        .modal-flex { display: flex; width: 100%; height: 100%; }
        .video-section { flex: 1; background: #000; }
        .insights-section { flex: 0.8; padding: 2rem; overflow-y: auto; display: flex; flex-direction: column; }
        .player-wrapper { width: 100%; height: 100%; }
        .embed-frame { width: 100%; height: 100%; border: none; }

        .page-premium { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255, 255, 255, 0.05); padding: 0.4rem 1rem; border-radius: 99rem; font-size: 0.7rem; font-weight: 800; color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 1.5rem; letter-spacing: 0.1em; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        
        .filter-controls { display: flex; flex-direction: column; gap: 1rem; align-items: center; margin-top: 1rem; width: 100%; }
        @media (min-width: 1024px) { .filter-controls { align-items: flex-end; } }

        .category-nav, .platform-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
        @media (min-width: 1024px) { .category-nav, .platform-nav { justify-content: flex-end; } }
        .category-btn, .platform-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border-radius: 99rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid rgba(255, 255, 255, 0.05); background: rgba(255, 255, 255, 0.03); color: #94a3b8; }

        .category-btn:hover, .platform-btn:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
        .category-btn.active { background: #fff; color: #000; border-color: #fff; box-shadow: 0 4px 15px rgba(255,255,255,0.2); }

        .platform-btn.active { color: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .platform-btn.active.youtube { background: linear-gradient(135deg, #ef4444, #dc2626); border-color: #ef4444; }
        .platform-btn.active.instagram { background: linear-gradient(135deg, #ec4899, #db2777); border-color: #ec4899; }
        .platform-btn.active.tiktok { background: linear-gradient(135deg, #22d3ee, #06b6d4); border-color: #22d3ee; }
        .platform-btn.active.All { background: linear-gradient(135deg, #6366f1, #4f46e5); border-color: #6366f1; }
      `}</style>
    </main>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Calendar, 
  TrendingUp, 
  ChevronRight, 
  X,
  ArrowUpRight,
  RefreshCw,
  SearchCheck,
  LineChart as ChartIcon
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function NaverShoppingPage() {
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // History Modal State
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [keywordHistory, setKeywordHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Rank Change Component (Inside to inherit styles)
  const RankChangeIcon = ({ change }) => {
    if (change === 'NEW') {
      return <span className="change-badge new">NEW</span>;
    }
    
    if (change > 0) {
      return <span className="change-badge up">▲{change}</span>;
    }
    
    if (change < 0) {
      return <span className="change-badge down">▼{Math.abs(change)}</span>;
    }
    
    return <span className="change-badge same">-</span>;
  };

  // 초기 데이터 (날짜 리스트) 가져오기
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const response = await fetch('/api/shopping-insight/dates');
        const data = await response.json();
        if (data.dates && data.dates.length > 0) {
          setAvailableDates(data.dates);
          setSelectedDate(data.dates[0]); // 최신 날짜 기본 선택
        }
      } catch (err) {
        console.error('Failed to fetch dates:', err);
      }
    };
    fetchDates();
  }, []);

  const fetchRankings = async (date) => {
    if (!date) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/shopping-insight?date=${date}`);
      const data = await response.json();
      if (data.rankings) {
        setRankings(data.rankings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchRankings(selectedDate);
    }
  }, [selectedDate]);

  const fetchKeywordHistory = async (keyword) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/shopping-insight/keyword-history?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      setKeywordHistory(data.history);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleKeywordClick = (keyword) => {
    setSelectedKeyword(keyword);
    fetchKeywordHistory(keyword);
  };

  const filteredRankings = useMemo(() => {
    return rankings.filter(item => 
      item.keyword.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rankings, searchTerm]);

  const topThree = rankings.slice(0, 3);
  const others = filteredRankings.filter(item => item.rank > 3 || (searchTerm && item.rank <= 3));

  const historyChartData = useMemo(() => {
    if (!keywordHistory) return null;
    return {
      labels: keywordHistory.map(h => `${h.date.slice(4,6)}/${h.date.slice(6,8)}`),
      datasets: [{
        label: '순위',
        data: keywordHistory.map(h => h.rank),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#3b82f6',
        tension: 0.4,
        fill: true,
        reverse: true, // 순위이므로 낮은 숫자가 위로
      }]
    };
  }, [keywordHistory]);

  const historyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        reverse: true, // 1위가 가장 위로
        min: 1,
        max: 500,
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      x: {
        ticks: { color: '#64748b' },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.raw}위`
        }
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRankings(selectedDate);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <main className="shopping-page custom-scrollbar">
      <div className="hero-blob"></div>
      <div className="hero-blob-2"></div>

      <div className="container">
        <header className="page-header">
          <div className="header-left">
            <div className="badge-premium">
              <ShoppingBag size={14} />
              <span>SHOPPING INSIGHT</span>
            </div>
            <h1 className="title-gradient">네이버 쇼핑 인기 검색어</h1>
            <p className="subtitle">
              화장품/미용 카테고리 실시간 TOP 500 마켓 트렌드 
              <span className="comparison-info"> (일주일 전 순위 대비 변동률 포함)</span>
            </p>
          </div>
          
          <div className="header-right">
            <div className="date-select-wrapper glass-panel">
              <Calendar size={18} className="icon-blue" />
              <select 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-select"
              >
                {availableDates.map(date => (
                  <option key={date} value={date}>
                    {`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="search-box glass-panel">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="검색어 필터링..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-icon glass-panel" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="loader-container">
            <div className="spinner-large"></div>
            <p className="loading-text">데이터를 동기화 중입니다...</p>
          </div>
        ) : (
          <div className="content-grid">
            {/* Top 3 Section */}
            {!searchTerm && (
              <section className="top-section">
                <div className="section-title">
                  <TrendingUp size={20} className="icon-gold" />
                  <h2>실시간 급상승 TOP 3</h2>
                </div>
                <div className="top-cards">
                  {topThree.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`top-card rank-${item.rank}`}
                      onClick={() => handleKeywordClick(item.keyword)}
                    >
                      <div className="rank-badge">{item.rank}</div>
                      <div className="keyword-info">
                        <div className="name-wrapper">
                          <span className="keyword-name">{item.keyword}</span>
                          <RankChangeIcon change={item.rankChange} />
                        </div>
                        <div className="keyword-trend">
                          <ArrowUpRight size={14} />
                          <span>상세 히스토리 보기</span>
                        </div>
                      </div>
                      <div className="card-bg-icon">
                        <ShoppingBag size={80} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Others List */}
            <section className="list-section">
              <div className="section-header">
                <div className="section-title">
                  <SearchCheck size={20} className="icon-blue" />
                  <h2>인기 키워드 전체 리스트</h2>
                </div>
                <div className="list-count">
                  총 <strong>{filteredRankings.length}</strong>개 발견
                </div>
              </div>

              <div className="keyword-grid glass-panel">
                {others.length > 0 ? (
                  others.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="keyword-item"
                      onClick={() => handleKeywordClick(item.keyword)}
                    >
                      <span className="item-rank">{item.rank}</span>
                      <span className="item-name">{item.keyword}</span>
                      <div className="item-change-box">
                        <RankChangeIcon change={item.rankChange} />
                      </div>
                      <div className="item-action">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Search size={48} className="empty-icon" />
                    <p>검색 결과가 없습니다.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* History Modal */}
      {selectedKeyword && (
        <div className="modal-overlay" onClick={() => setSelectedKeyword(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedKeyword(null)}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <div className="modal-badge">RANKING HISTORY</div>
              <h2 className="modal-title">
                <span className="highlight-blue">{selectedKeyword}</span> 
                <span className="title-sub">순위 변동 추이</span>
              </h2>
            </div>
            
            <div className="modal-body">
              {historyLoading ? (
                <div className="modal-loader">
                  <div className="spinner"></div>
                  <span>히스토리 데이터를 분석 중입니다...</span>
                </div>
              ) : keywordHistory && keywordHistory.length > 0 ? (
                <div className="chart-container">
                  <div className="chart-wrapper">
                    <Line data={historyChartData} options={historyChartOptions} />
                  </div>
                  <div className="chart-footer">
                    <ChartIcon size={14} />
                    <span>최근 90일간의 순위 변화 데이터입니다. (낮을수록 고순위)</span>
                  </div>
                </div>
              ) : (
                <div className="modal-empty">
                  데이터가 존재하지 않습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .shopping-page {
          min-height: 100vh;
          padding-top: 10rem;
          padding-bottom: 0;
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

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 5rem;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .header-left { flex: 1; min-width: 300px; }

        .badge-premium {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.2);
          margin-bottom: 1.5rem;
          letter-spacing: 0.05em;
        }

        .title-gradient {
          font-size: 3.5rem;
          font-weight: 800;
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .subtitle {
          color: #64748b;
          font-weight: 500;
        }

        .comparison-info {
          font-size: 0.875rem;
          color: #3b82f6;
          opacity: 0.8;
          margin-left: 0.5rem;
        }

        .header-right {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .date-select-wrapper {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.25rem;
          border-radius: 1.25rem;
        }

        .date-select {
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-weight: 700;
          font-size: 1rem;
          outline: none;
          cursor: pointer;
        }

        .date-select option { background: #0f172a; color: #fff; }

        .search-box {
          display: flex;
          align-items: center;
          padding: 0.75rem 1.5rem;
          gap: 1rem;
          border-radius: 1.25rem;
          width: 250px;
        }

        .search-box input {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 1rem;
          width: 100%;
          outline: none;
        }

        .btn-icon {
          width: 3.5rem;
          height: 3.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem;
        }

        .loader-container {
          padding: 10rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .spinner-large {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(59, 130, 246, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .loading-text { color: #64748b; font-weight: 500; }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .section-title h2 {
          font-size: 1.50rem;
          font-weight: 800;
          color: #f1f5f9;
        }

        .top-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          margin-bottom: 5rem;
        }

        .top-card {
          position: relative;
          padding: 2.5rem;
          border-radius: 2.5rem;
          overflow: hidden;
          transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          cursor: pointer;
        }

        .top-card:hover { transform: translateY(-10px) scale(1.02); }

        .rank-1 { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(245, 158, 11, 0.3); }
        .rank-2 { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(148, 163, 184, 0.3); }
        .rank-3 { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(180, 83, 9, 0.3); }

        .rank-badge {
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: 900;
          font-size: 1.25rem;
          margin-bottom: 2rem;
          position: relative;
          z-index: 2;
        }

        .rank-1 .rank-badge { background: #f59e0b; color: #000; box-shadow: 0 0 20px rgba(245, 158, 11, 0.4); }
        .rank-2 .rank-badge { background: #94a3b8; color: #000; box-shadow: 0 0 20px rgba(148, 163, 184, 0.4); }
        .rank-3 .rank-badge { background: #b45309; color: #fff; box-shadow: 0 0 20px rgba(180, 83, 9, 0.4); }

        .keyword-name {
          display: block;
          font-size: 2rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 0.5rem;
          position: relative;
          z-index: 2;
        }

        .keyword-trend {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #64748b;
          font-weight: 600;
          font-size: 0.875rem;
          position: relative;
          z-index: 2;
        }

        .card-bg-icon {
          position: absolute;
          bottom: -1rem;
          right: -1rem;
          opacity: 0.05;
          transform: rotate(-15deg);
        }

        .name-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .item-change-box {
          min-width: 65px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        :global(.change-badge) {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          letter-spacing: -0.02em;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        :global(.change-badge.new) {
          background: rgba(245, 158, 11, 0.15) !important;
          color: #f59e0b !important;
          border: 1px solid rgba(245, 158, 11, 0.4) !important;
        }

        :global(.change-badge.up) {
          background: rgba(16, 185, 129, 0.15) !important;
          color: #10b981 !important;
          border: 1px solid rgba(16, 185, 129, 0.4) !important;
        }

        :global(.change-badge.down) {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #ef4444 !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
        }

        :global(.change-badge.same) {
          background: rgba(255, 255, 255, 0.05) !important;
          color: #64748b !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .list-count { color: #64748b; font-size: 0.875rem; }
        .list-count strong { color: #3b82f6; }

        .keyword-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 1rem;
        }

        @media (max-width: 1200px) { .keyword-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px) { .keyword-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .keyword-grid { grid-template-columns: repeat(1, 1fr); } .top-cards { grid-template-columns: 1fr; } }

        .keyword-item {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.25rem 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          border-right: 1px solid rgba(255, 255, 255, 0.03);
          transition: background 0.2s ease;
          cursor: pointer;
        }

        .keyword-item:hover { background: rgba(255, 255, 255, 0.02); }

        .item-rank {
          font-size: 0.875rem;
          font-weight: 800;
          color: #475569;
          min-width: 2rem;
        }

        .item-name {
          flex: 1;
          font-weight: 600;
          color: #cbd5e1;
        }

        .item-change-box {
          min-width: 60px;
          display: flex;
          justify-content: flex-end;
        }

        .item-action {
          color: #475569;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .keyword-item:hover .item-action { opacity: 1; transform: translateX(3px); }

        .empty-state {
          grid-column: 1 / -1;
          padding: 5rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          color: #475569;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        .modal-content {
          width: 90%;
          max-width: 1000px;
          padding: 4rem;
          position: relative;
          animation: slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .btn-close {
          position: absolute;
          top: 2rem;
          right: 2rem;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          transition: color 0.2s;
        }

        .btn-close:hover { color: #fff; }

        .modal-header { margin-bottom: 3rem; }
        
        .modal-badge {
          display: inline-block;
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          padding: 0.4rem 0.8rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
        }

        .modal-title { font-size: 2.5rem; font-weight: 800; }
        .highlight-blue { color: #3b82f6; margin-right: 1rem; }
        .title-sub { color: #64748b; font-weight: 400; }

        .chart-container { height: 400px; display: flex; flex-direction: column; gap: 2rem; }
        .chart-wrapper { flex: 1; }

        .chart-footer {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #475569;
          font-size: 0.875rem;
          background: rgba(255, 255, 255, 0.02);
          padding: 1rem 1.5rem;
          border-radius: 1rem;
        }

        .modal-loader {
          height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(59, 130, 246, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .animate-spin { animation: spin 2s linear infinite; }
      `}</style>
    </main>
  );
}

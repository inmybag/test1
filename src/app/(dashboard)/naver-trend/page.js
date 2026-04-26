'use client';

import { useState, useEffect } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, Calendar, Info, RefreshCw } from 'lucide-react';

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

export default function NaverTrendPage() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState(null);

  const categories = [
    { name: '스킨케어', keywords: ['스킨케어', '앰플', '세럼', '크림', '토너'] },
    { name: '메이크업', keywords: ['메이크업', '쿠션', '틴트', '파운데이션', '아이섀도우'] },
    { name: '헤어케어', keywords: ['헤어케어', '샴푸', '트리트먼트', '헤어오일', '린스'] },
    { name: '바디케어', keywords: ['바디케어', '바디로션', '바디워시', '핸드크림', '바디스크럽'] }
  ];

  const fetchTrendData = async () => {
    setLoading(true);
    setError(null);

    const now = new Date();
    const endDate = new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')[0];
    const startDate = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];

    const requestBody = {
      startDate,
      endDate,
      timeUnit: 'date',
      keywordGroups: categories.map(cat => ({
        groupName: cat.name,
        keywords: cat.keywords
      }))
    };

    try {
      const response = await fetch('/api/naver/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('네이버 API 호출에 실패했습니다.');
      }

      const data = await response.json();
      processChartData(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (apiData) => {
    if (!apiData || !apiData.results || apiData.results.length === 0) {
      setError('네이버 데이터랩 API에서 데이터를 반환하지 않았습니다. 검색량이 부족하거나 일시적인 오류일 수 있습니다.');
      return;
    }
    
    const labels = apiData.results[0].data.map(item => item.period);
    
    const datasets = apiData.results.map((result, index) => {
      const colors = [
        { border: '#3b82f6', back: 'rgba(59, 130, 246, 0.1)' },
        { border: '#a855f7', back: 'rgba(168, 85, 247, 0.1)' },
        { border: '#10b981', back: 'rgba(16, 185, 129, 0.1)' },
        { border: '#f59e0b', back: 'rgba(245, 158, 11, 0.1)' }
      ];
      
      const color = colors[index % colors.length];

      return {
        label: result.title,
        data: result.data.map(item => item.ratio),
        borderColor: color.border,
        backgroundColor: color.back,
        borderWidth: 3,
        pointBackgroundColor: color.border,
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      };
    });

    setChartData({ labels, datasets });
  };

  useEffect(() => {
    fetchTrendData();
  }, []);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 12, weight: '600' },
          padding: 20,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        padding: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        displayColors: true,
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.raw.toFixed(1)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
        ticks: { 
          color: '#64748b', 
          font: { size: 11 },
          callback: (value) => value + '%'
        },
        beginAtZero: true
      }
    }
  };

  return (
    <main className="trend-page custom-scrollbar">
      <div className="hero-blob"></div>
      <div className="hero-blob-2"></div>

      <div className="container">
        <header className="page-header">
          <div className="header-content">
            <div className="badge-premium">
              <TrendingUp size={14} />
              <span>MARKET TREND INSIGHT</span>
            </div>
            <h1 className="title-gradient">네이버 검색어 트렌드</h1>
            <p className="subtitle">네이버 데이터랩 기반 카테고리별 검색량 추이 분석</p>
          </div>
          <button onClick={fetchTrendData} className="btn-refresh" disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </header>

        <div className="trend-container glass-panel">
          <div className="chart-header">
            <div className="chart-info">
              <Calendar size={18} className="icon-blue" />
              <h3>최근 7일 트렌드 분석</h3>
            </div>
            <div className="date-range">
              {chartData?.labels?.[0]} ~ {chartData?.labels?.slice(-1)[0]}
            </div>
          </div>

          <div className="chart-wrapper">
            {loading ? (
              <div className="chart-loader">
                <div className="spinner"></div>
                <span>데이터를 불러오는 중입니다...</span>
              </div>
            ) : error ? (
              <div className="error-display">
                <Info size={24} />
                <p>{error}</p>
                <button onClick={fetchTrendData}>다시 시도</button>
              </div>
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </div>
        </div>

        <div className="category-grid">
          {categories.map((cat, idx) => (
            <div key={idx} className="category-card glass-panel">
              <div className="cat-header">
                <span className={`dot dot-${idx}`}></span>
                <h4>{cat.name}</h4>
              </div>
              <div className="keyword-tags">
                {cat.keywords.map((kw, kIdx) => (
                  <span key={kIdx} className="tag">{kw}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .trend-page {
          padding-top: 10rem;
          padding-bottom: 2rem;
          background-color: #050507;
          color: #fff;
          position: relative;
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
          bottom: 0;
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
          margin-bottom: 4rem;
        }

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
          font-size: 1.125rem;
          color: #64748b;
          font-weight: 500;
        }

        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 0.75rem 1.5rem;
          border-radius: 1rem;
          font-weight: 600;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .btn-refresh:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

        .glass-panel {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .trend-container {
          padding: 3rem;
          margin-bottom: 3rem;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3rem;
        }

        .chart-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .chart-info h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f1f5f9;
        }

        .icon-blue { color: #3b82f6; }

        .date-range {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          padding: 0.5rem 1.25rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 700;
          border: 1px solid rgba(59, 130, 246, 0.1);
        }

        .chart-wrapper {
          height: 500px;
          position: relative;
        }

        .chart-loader, .error-display {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          color: #64748b;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(59, 130, 246, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .error-display button {
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 2rem;
        }
        @media (min-width: 768px) { .category-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1200px) { .category-grid { grid-template-columns: repeat(4, 1fr); } }

        .category-card {
          padding: 2rem;
          transition: transform 0.3s ease;
        }

        .category-card:hover { transform: translateY(-5px); }

        .cat-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot-0 { background: #3b82f6; box-shadow: 0 0 10px #3b82f6; }
        .dot-1 { background: #a855f7; box-shadow: 0 0 10px #a855f7; }
        .dot-2 { background: #10b981; box-shadow: 0 0 10px #10b981; }
        .dot-3 { background: #f59e0b; box-shadow: 0 0 10px #f59e0b; }

        .cat-header h4 { font-size: 1.125rem; font-weight: 700; color: #f1f5f9; }

        .keyword-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          background: rgba(255, 255, 255, 0.05);
          color: #94a3b8;
          padding: 0.35rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .animate-spin { animation: spin 2s linear infinite; }
      `}</style>
    </main>
  );
}

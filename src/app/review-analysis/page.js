'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Calendar, ChevronDown, X, TrendingUp, TrendingDown, BarChart3, MessageSquare, Megaphone, Loader2 } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import ProductUrlManager from './ProductUrlManager';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const TABS = [
  { id: 'dashboard', label: '대시보드', icon: BarChart3 },
  { id: 'period', label: '기간별 분석', icon: TrendingUp },
  { id: 'sentiment', label: '긍/부정 분석', icon: TrendingDown },
  { id: 'voc', label: 'VoC 분석', icon: MessageSquare },
  { id: 'marketing', label: '마케팅분석', icon: Megaphone },
];

// Chart colors
const CHART_COLORS = [
  '#4A90D9', '#E8734A', '#50C878', '#9B59B6', '#F39C12', '#1ABC9C', '#E74C3C', '#3498DB'
];

export default function ReviewAnalysisPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showUrlManager, setShowUrlManager] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Tab data states
  const [dashboardData, setDashboardData] = useState([]);
  const [periodData, setPeriodData] = useState({ periodData: [], reviews: [] });
  const [sentimentData, setSentimentData] = useState({ attributeStats: [], attributeReviews: [] });
  const [vocData, setVocData] = useState([]);
  const [marketingData, setMarketingData] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);

  // Period Analysis Pagination States
  const [reviewPage, setReviewPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const dropdownRef = useRef(null);

  // 초기 날짜 설정 (최근 30일)
  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
    fetchProducts();
  }, []);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 선택 변경 시 데이터 갱신
  useEffect(() => {
    if (selectedProducts.length > 0 && startDate && endDate) {
      fetchTabData(activeTab);
    }
  }, [selectedProducts, startDate, endDate, activeTab]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/reviews/products');
      const { data } = await res.json();
      setProducts(data || []);
      if (data && data.length > 0 && selectedProducts.length === 0) {
        setSelectedProducts(data.map(p => p.id));
      }
    } catch (err) {
      console.error('제품 목록 로드 실패:', err);
    }
  };

  const fetchTabData = async (tab) => {
    if (selectedProducts.length === 0) return;
    setLoading(true);
    const ids = selectedProducts.join(',');
    const base = `/api/reviews`;

    try {
      switch (tab) {
        case 'dashboard': {
          const res = await fetch(`${base}/dashboard?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`);
          const { data } = await res.json();
          setDashboardData(data || []);
          break;
        }
        case 'period': {
          setReviewPage(1);
          const params = new URLSearchParams({ productIds: ids, startDate, endDate, page: 1 });
          if (sentimentFilter) params.set('sentiment', sentimentFilter);
          if (selectedAttribute) params.set('attribute', selectedAttribute);
          const res = await fetch(`${base}/period?${params}`);
          const data = await res.json();
          setPeriodData(data || { periodData: [], reviews: [] });
          setHasMoreReviews(data?.reviews?.length === 10);
          break;
        }
        case 'sentiment': {
          const params = new URLSearchParams({ productIds: ids, startDate, endDate });
          if (selectedAttribute) params.set('attribute', selectedAttribute);
          const res = await fetch(`${base}/sentiment?${params}`);
          const data = await res.json();
          setSentimentData(data || { attributeStats: [], attributeReviews: [] });
          break;
        }
        case 'voc': {
          const res = await fetch(`${base}/voc?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`);
          const { data } = await res.json();
          setVocData(data || []);
          break;
        }
        case 'marketing': {
          const res = await fetch(`${base}/marketing?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`);
          const { data } = await res.json();
          setMarketingData(data || null);
          break;
        }
      }
    } catch (err) {
      console.error(`${tab} 데이터 로드 실패:`, err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreReviews = async () => {
    if (loadingMore || !hasMoreReviews || selectedProducts.length === 0) return;
    setLoadingMore(true);
    const nextPage = reviewPage + 1;
    const ids = selectedProducts.join(',');
    const params = new URLSearchParams({ productIds: ids, startDate, endDate, page: nextPage });
    if (sentimentFilter) params.set('sentiment', sentimentFilter);
    if (selectedAttribute) params.set('attribute', selectedAttribute);
    
    try {
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      const newReviews = data.reviews || [];
      if (newReviews.length > 0) {
        setPeriodData(prev => ({
          ...prev,
          reviews: [...prev.reviews, ...newReviews]
        }));
      }
      setHasMoreReviews(newReviews.length === 10);
      setReviewPage(nextPage);
    } catch (err) {
      console.error('리뷰 추가 로드 실패:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleProduct = (id) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const removeProduct = (id) => {
    setSelectedProducts(prev => prev.filter(p => p !== id));
  };

  // ========================
  // 대시보드 탭
  // ========================
  const renderDashboard = () => {
    if (dashboardData.length === 0) {
      return <div className="ra-empty-state">선택된 제품의 리뷰 데이터가 없습니다.</div>;
    }

    return (
      <div className="ra-dashboard-grid">
        {dashboardData.map((item) => {
          const totalReviews = parseInt(item.totalReviews) || 0;
          const positiveCount = parseInt(item.positiveCount) || 0;
          const negativeCount = parseInt(item.negativeCount) || 0;
          const positiveRate = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;
          const negativeRate = totalReviews > 0 ? Math.round((negativeCount / totalReviews) * 100) : 0;
          const topPos = item.topAttributes?.positive || [];
          const topNeg = item.topAttributes?.negative || [];

          return (
            <div key={item.productId} className="ra-dashboard-row">
              {/* 카드 1: 신규 리뷰 수 */}
              <div className="ra-dash-card glass-panel">
                <div className="ra-dash-card-header">
                  {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="ra-dash-thumb" />}
                  <div>
                    <span className="ra-dash-brand">{item.brandName}</span>
                    <h4>{item.productName}</h4>
                    {(() => {
                      const p = products.find(prod => String(prod.id) === String(item.productId));
                      const link = p?.pageUrl || p?.page_url;
                      if (link) {
                         return <a href={link} target="_blank" className="ra-external-link" rel="noreferrer">상품 상세 보기 ↗</a>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="ra-dash-stat">
                  <span className="ra-dash-number">{totalReviews.toLocaleString()}</span>
                  <span className="ra-dash-label">신규 리뷰수</span>
                  <span className={`ra-dash-growth ${item.growthRate >= 0 ? 'positive' : 'negative'}`}>
                    {item.growthRate >= 0 ? '↑' : '↓'} {Math.abs(item.growthRate)}%
                  </span>
                </div>
              </div>

              {/* 카드 2: 긍/부정 비율 */}
              <div className="ra-dash-card glass-panel">
                <h4>{item.brandName} {item.productName}</h4>
                <div className="ra-sentiment-bars">
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label positive">긍정리뷰비중</span>
                    <div className="ra-bar-track">
                      <div className="ra-bar-fill positive" style={{ width: `${positiveRate}%` }}></div>
                    </div>
                    <span className="ra-sentiment-pct positive">{positiveRate}%</span>
                  </div>
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label negative">부정리뷰비중</span>
                    <div className="ra-bar-track">
                      <div className="ra-bar-fill negative" style={{ width: `${negativeRate}%` }}></div>
                    </div>
                    <span className="ra-sentiment-pct negative">{negativeRate}%</span>
                  </div>
                </div>
                {item.avgRating && (
                  <div className="ra-avg-rating">
                    평균 ★ {item.avgRating}
                  </div>
                )}
              </div>

              {/* 카드 3: TOP 속성 */}
              <div className="ra-dash-card glass-panel">
                <h4>{item.brandName} {item.productName}</h4>
                <div className="ra-top-attrs">
                  <div className="ra-attr-section">
                    <span className="ra-attr-title positive">TOP3 긍정 속성</span>
                    <span className="ra-attr-values positive">
                      {topPos.length > 0 ? topPos.slice(0, 3).map(a => a.name).join(', ') : '-'}
                    </span>
                  </div>
                  <div className="ra-attr-section">
                    <span className="ra-attr-title negative">TOP3 부정 속성</span>
                    <span className="ra-attr-values negative">
                      {topNeg.length > 0 ? topNeg.slice(0, 3).map(a => a.name).join(', ') : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ========================
  // 기간별 분석 탭
  // ========================
  const renderPeriod = () => {
    const { periodData: pData, reviews } = periodData;

    // 일자별 데이터 가공 (제품별 비교)
    const dateMap = {};
    const productNames = {};
    (pData || []).forEach(d => {
      if (!dateMap[d.reviewDate]) dateMap[d.reviewDate] = {};
      dateMap[d.reviewDate][d.productId] = parseInt(d.count);
      productNames[d.productId] = d.productName;
    });

    const dates = Object.keys(dateMap).sort();
    const productIdList = Object.keys(productNames);

    const lineChartData = {
      labels: dates.map(d => d.slice(5)), // MM-DD
      datasets: productIdList.map((pid, idx) => ({
        label: productNames[pid],
        data: dates.map(d => dateMap[d]?.[pid] || 0),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + '33',
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
      })),
    };

    const lineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e2e8f0', font: { size: 12 } } },
        title: { display: true, text: '일자별 리뷰 생성 수', color: '#f8fafc', font: { size: 16, weight: 'bold' } },
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
      },
    };

    return (
      <div className="ra-period-container">
        <div className="ra-period-left">
          <div className="ra-chart-panel glass-panel">
            <div style={{ height: 350 }}>
              {dates.length > 0 ? (
                <Line data={lineChartData} options={lineChartOptions} />
              ) : (
                <div className="ra-empty-state">차트 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
        <div className="ra-period-right">
          {/* 감성 필터 */}
          <div className="ra-filter-bar">
            {['전체', '긍정', '중립', '부정'].map(label => {
              const val = label === '전체' ? null : label === '긍정' ? 'positive' : label === '부정' ? 'negative' : 'neutral';
              return (
                <button
                  key={label}
                  className={`ra-filter-chip \${sentimentFilter === val ? 'active' : ''}`}
                  onClick={() => { setSentimentFilter(val); }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 속성 태그 */}
          {sentimentData.attributeStats?.length > 0 && (
            <div className="ra-attr-tags">
              {sentimentData.attributeStats.slice(0, 8).map(attr => (
                <button
                  key={attr.name}
                  className={`ra-attr-tag \${selectedAttribute === attr.name ? 'active' : ''}`}
                  onClick={() => setSelectedAttribute(selectedAttribute === attr.name ? null : attr.name)}
                >
                  {attr.name} ({attr.total})
                </button>
              ))}
            </div>
          )}

          {/* 리뷰 목록 */}
          <div className="ra-review-list">
            {(reviews || []).map((review, idx) => {
              const p = products.find(prod => String(prod.id) === String(review.productId));
              return (
              <div key={idx} className="ra-review-item glass-panel">
                <div className="ra-review-header">
                  <div className="ra-review-meta-left">
                    <span className="ra-review-date">{review.reviewDate}</span>
                    <span className={`ra-sentiment-badge \${review.sentiment}`}>{review.sentiment === 'positive' ? '긍정' : review.sentiment === 'negative' ? '부정' : '중립'}</span>
                    <span className="ra-rating">★ {review.rating}</span>
                  </div>
                  <div className="ra-review-meta-right">
                    <span className="ra-review-platform">{p?.platform || ''}</span>
                    <span className="ra-review-brand">{review.brandName}</span>
                    <span className="ra-review-product">{review.productName}</span>
                  </div>
                </div>
                <div className="ra-review-extra">
                  <span className="ra-extra-tag"><b>작성자</b>: {review.reviewerNickname}</span>
                  {review.extraInfo && Object.entries(review.extraInfo).map(([k,v]) => {
                     if (!v) return null;
                     return <span key={k} className="ra-extra-tag"><b>{k}</b>: {v}</span>;
                  })}
                </div>
                <div className="ra-review-text">
                  {renderHighlightedText(review.reviewText, review.sourceHighlight || [])}
                </div>
                <div className="ra-review-tags">
                  {(review.attributes || []).map((attr, ai) => (
                    <span key={ai} className={`ra-review-attr-tag \${attr.sentiment}`}>
                      {attr.name} — {attr.sentiment === 'positive' ? '긍정' : attr.sentiment === 'negative' ? '부정' : '중립'}
                    </span>
                  ))}
                </div>

                {review.mediaUrls && review.mediaUrls.length > 0 && (
                  <div className="ra-review-media-gallery">
                    {review.mediaUrls.map((url, mi) => {
                      const isVideo = url.toLowerCase().match(/\.(mp4|mov|webm|ogg)$/) || url.includes('video') || url.includes('crema.me/v/');
                      return (
                        <div key={mi} className="ra-review-media-item">
                          {isVideo ? (
                            <div className="ra-video-wrapper">
                              <video 
                                src={url} 
                                controls={false} 
                                muted 
                                loop 
                                onMouseOver={(e) => e.target.play()} 
                                onMouseOut={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                                className="ra-review-video"
                              />
                              <div className="ra-video-badge">VIDEO</div>
                            </div>
                          ) : (
                            <img src={url} alt={`review-media-\${mi}`} className="ra-review-img" loading="lazy" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )})}
            {(!reviews || reviews.length === 0) && (
              <div className="ra-empty-state">리뷰 데이터가 없습니다.</div>
            )}
            {hasMoreReviews && reviews && reviews.length > 0 && (
              <button className="ra-load-more" onClick={loadMoreReviews} disabled={loadingMore}>
                {loadingMore ? '불러오는 중...' : `리뷰 더보기 (현재 ${reviewPage}페이지)`}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 원문 하이라이트 렌더링
  const renderHighlightedText = (text, highlights) => {
    if (!text) return null;
    if (!highlights || highlights.length === 0) return <span>{text}</span>;

    // 하이라이트 위치 찾기
    const parts = [];
    let lastIndex = 0;

    const sorted = highlights
      .map(h => {
        const idx = text.indexOf(h.text);
        return { ...h, startIdx: idx };
      })
      .filter(h => h.startIdx >= 0)
      .sort((a, b) => a.startIdx - b.startIdx);

    for (const h of sorted) {
      if (h.startIdx > lastIndex) {
        parts.push({ text: text.slice(lastIndex, h.startIdx), highlight: false });
      }
      if (h.startIdx >= lastIndex) {
        parts.push({ text: h.text, highlight: true, sentiment: h.sentiment, attribute: h.attribute });
        lastIndex = h.startIdx + h.text.length;
      }
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlight: false });
    }

    if (parts.length === 0) return <span>{text}</span>;

    return (
      <span>
        {parts.map((p, i) =>
          p.highlight ? (
            <mark key={i} className={`ra-highlight ${p.sentiment}`} title={`${p.attribute} — ${p.sentiment}`}>
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </span>
    );
  };

  // ========================
  // 긍/부정 분석 탭
  // ========================
  const renderSentiment = () => {
    const { attributeStats, attributeReviews } = sentimentData;
    const { periodData: pData } = periodData;

    // 일자별 긍정/부정 리뷰 데이터
    const dateMap = {};
    (pData || []).forEach(d => {
      if (!dateMap[d.reviewDate]) dateMap[d.reviewDate] = { total: 0, positive: 0, negative: 0 };
      dateMap[d.reviewDate].total += parseInt(d.count);
      dateMap[d.reviewDate].positive += parseInt(d.positiveCount);
      dateMap[d.reviewDate].negative += parseInt(d.negativeCount);
    });

    const dates = Object.keys(dateMap).sort();
    const productNames = {};
    (pData || []).forEach(d => { productNames[d.productId] = d.productName; });
    const productIdList = Object.keys(productNames);

    // 전체 차트
    const totalChartData = {
      labels: dates.map(d => d.slice(5)),
      datasets: productIdList.map((pid, idx) => ({
        label: productNames[pid],
        data: dates.map(d => {
          const items = (pData || []).filter(p => p.reviewDate === d && String(p.productId) === pid);
          return items.reduce((s, i) => s + parseInt(i.count), 0);
        }),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        tension: 0.3,
        fill: false,
        pointRadius: 4,
      })),
    };

    const positiveChartData = {
      labels: dates.map(d => d.slice(5)),
      datasets: productIdList.map((pid, idx) => ({
        label: productNames[pid],
        data: dates.map(d => {
          const items = (pData || []).filter(p => p.reviewDate === d && String(p.productId) === pid);
          return items.reduce((s, i) => s + parseInt(i.positiveCount), 0);
        }),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        tension: 0.3,
        fill: false,
        pointRadius: 4,
      })),
    };

    const negativeChartData = {
      labels: dates.map(d => d.slice(5)),
      datasets: productIdList.map((pid, idx) => ({
        label: productNames[pid],
        data: dates.map(d => {
          const items = (pData || []).filter(p => p.reviewDate === d && String(p.productId) === pid);
          return items.reduce((s, i) => s + parseInt(i.negativeCount), 0);
        }),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        tension: 0.3,
        fill: false,
        pointRadius: 4,
      })),
    };

    const smallChartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e2e8f0', font: { size: 10 } } },
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
      },
    };

    // 속성별 긍/부정 비율 가로 막대 차트
    const attrBarData = {
      labels: (attributeStats || []).slice(0, 8).map(a => a.name),
      datasets: [
        {
          label: '긍정',
          data: (attributeStats || []).slice(0, 8).map(a => a.positiveRate || 0),
          backgroundColor: '#4A90D9',
        },
        {
          label: '부정',
          data: (attributeStats || []).slice(0, 8).map(a => a.negativeRate || 0),
          backgroundColor: '#E8734A',
        },
      ],
    };

    const barChartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { labels: { color: '#e2e8f0' } },
        title: { display: true, text: '긍/부정 비율', color: '#f8fafc', font: { size: 14, weight: 'bold' } },
      },
      scales: {
        x: { stacked: true, max: 100, ticks: { color: '#94a3b8', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { stacked: true, ticks: { color: '#e2e8f0' }, grid: { display: false } },
      },
    };

    return (
      <div className="ra-sentiment-container">
        <div className="ra-sentiment-charts">
          <div className="ra-chart-small glass-panel">
            <h4>일별 리뷰 생성 수</h4>
            <div style={{ height: 220 }}>
              {dates.length > 0 ? <Line data={totalChartData} options={{...smallChartOpts, plugins: {...smallChartOpts.plugins, title: { display: true, text: '전체', color: '#f8fafc' }}}} /> : <div className="ra-empty-state">데이터 없음</div>}
            </div>
          </div>
          <div className="ra-chart-small glass-panel">
            <h4>긍정 리뷰 생성 수</h4>
            <div style={{ height: 220 }}>
              {dates.length > 0 ? <Line data={positiveChartData} options={{...smallChartOpts, plugins: {...smallChartOpts.plugins, title: { display: true, text: '긍정', color: '#4A90D9' }}}} /> : <div className="ra-empty-state">데이터 없음</div>}
            </div>
          </div>
          <div className="ra-chart-small glass-panel">
            <h4>부정 리뷰 생성 수</h4>
            <div style={{ height: 220 }}>
              {dates.length > 0 ? <Line data={negativeChartData} options={{...smallChartOpts, plugins: {...smallChartOpts.plugins, title: { display: true, text: '부정', color: '#E8734A' }}}} /> : <div className="ra-empty-state">데이터 없음</div>}
            </div>
          </div>
        </div>
        <div className="ra-sentiment-ratio glass-panel">
          <div style={{ height: 350 }}>
            {(attributeStats || []).length > 0 ? (
              <Bar data={attrBarData} options={barChartOpts} />
            ) : (
              <div className="ra-empty-state">속성 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ========================
  // VoC 분석 탭
  // ========================
  const renderVoc = () => {
    return (
      <div className="ra-voc-container">
        {vocData.length === 0 ? (
          <div className="ra-empty-state">VoC 데이터가 없습니다.</div>
        ) : (
          <div className="ra-voc-grid">
            {vocData.map((voc, idx) => (
              <div key={idx} className="ra-voc-card glass-panel">
                <div className="ra-voc-header">
                  <h4>{voc.name}</h4>
                  <span className="ra-voc-count">총 {voc.totalCount}건</span>
                </div>
                <div className="ra-voc-body">
                  <div className="ra-voc-section">
                    <span className="ra-voc-label positive">긍정 ({voc.positive?.count || 0})</span>
                    <div className="ra-voc-keywords">
                      {(voc.positive?.keywords || []).map((kw, ki) => (
                        <span key={ki} className="ra-voc-keyword positive">{kw.keyword} ({kw.count})</span>
                      ))}
                      {(!voc.positive?.keywords || voc.positive.keywords.length === 0) && <span className="ra-voc-empty">-</span>}
                    </div>
                  </div>
                  <div className="ra-voc-section">
                    <span className="ra-voc-label negative">부정 ({voc.negative?.count || 0})</span>
                    <div className="ra-voc-keywords">
                      {(voc.negative?.keywords || []).map((kw, ki) => (
                        <span key={ki} className="ra-voc-keyword negative">{kw.keyword} ({kw.count})</span>
                      ))}
                      {(!voc.negative?.keywords || voc.negative.keywords.length === 0) && <span className="ra-voc-empty">-</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ========================
  // 마케팅 분석 탭
  // ========================
  const renderMarketing = () => {
    if (!marketingData || !marketingData.products || marketingData.products.length === 0) {
      return <div className="ra-empty-state">{loading ? '마케팅 분석을 생성 중입니다...' : '마케팅 분석 데이터가 없습니다.'}</div>;
    }

    return (
      <div className="ra-marketing-container">
        {marketingData.products.map((product, idx) => (
          <div key={idx} className="ra-marketing-product glass-panel">
            <h3 className="ra-marketing-title">{product.productName}</h3>
            
            {/* 불만 VoC 대응 방안 */}
            <div className="ra-marketing-section">
              <div className="ra-marketing-section-header negative">
                <MessageSquare size={18} />
                <h4>{product.vocResponse?.title || '불만 VoC 대응 방안'}</h4>
              </div>
              <ul className="ra-marketing-list">
                {(product.vocResponse?.actions || []).map((action, ai) => (
                  <li key={ai}>{action}</li>
                ))}
              </ul>
            </div>

            {/* 마케팅 활용 포인트 */}
            <div className="ra-marketing-grid">
              <div className="ra-marketing-block">
                <h5>💡 캐치프라이즈</h5>
                <ul>
                  {(product.marketingPoints?.catchphrase || []).map((cp, ci) => (
                    <li key={ci} className="ra-catchphrase">"{cp}"</li>
                  ))}
                </ul>
              </div>
              <div className="ra-marketing-block">
                <h5>🎯 USP (차별화 포인트)</h5>
                <ul>
                  {(product.marketingPoints?.usp || []).map((u, ui) => (
                    <li key={ui}>{u}</li>
                  ))}
                </ul>
              </div>
              <div className="ra-marketing-block">
                <h5>🎬 콘텐츠 제작 아이디어</h5>
                <ul>
                  {(product.marketingPoints?.contentIdeas || []).map((c, ci) => (
                    <li key={ci}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 개선 제안 */}
            {product.improvementSuggestions && product.improvementSuggestions.length > 0 && (
              <div className="ra-marketing-section">
                <div className="ra-marketing-section-header improve">
                  <TrendingUp size={18} />
                  <h4>개선 제안</h4>
                </div>
                <ul className="ra-marketing-list">
                  {product.improvementSuggestions.map((s, si) => (
                    <li key={si}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="container ra-container">
      {/* 상단 헤더 */}
      <header className="ra-header">
        <div className="ra-header-top">
          <div className="ra-title-area">
            <h1 className="ra-page-title">리뷰분석</h1>
          </div>
          <div className="ra-date-range">
            <Calendar size={16} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span>~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* 제품 선택기 */}
        <div className="ra-product-selector">
          <div className="ra-dropdown-area" ref={dropdownRef}>
            <button className="ra-dropdown-trigger glass-panel" onClick={() => setShowProductDropdown(!showProductDropdown)}>
              <span>{selectedProducts.length > 0 ? `${selectedProducts.length}개 제품 선택됨` : '제품을 선택하세요'}</span>
              <ChevronDown size={16} />
            </button>
            {showProductDropdown && (
              <div className="ra-dropdown-menu glass-panel">
                {products.map(p => (
                  <label key={p.id} className="ra-dropdown-item">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="ra-dropdown-brand">{p.brandName || p.brand_name}</span>
                    <span>{p.productName || p.product_name}</span>
                  </label>
                ))}
                {products.length === 0 && <div className="ra-dropdown-empty">등록된 제품이 없습니다</div>}
              </div>
            )}
          </div>

          {/* 선택된 제품 태그 */}
          <div className="ra-selected-tags">
            {selectedProducts.map(id => {
              const p = products.find(pp => pp.id === id);
              if (!p) return null;
              return (
                <span key={id} className="ra-selected-tag">
                  {p.brandName || p.brand_name} {p.productName || p.product_name}
                  <button onClick={() => removeProduct(id)}><X size={12} /></button>
                </span>
              );
            })}
          </div>

          <button className="ra-manage-btn" onClick={() => setShowUrlManager(true)}>
            <Settings size={16} /> URL 관리
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="ra-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`ra-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* 콘텐츠 영역 */}
      <div className="ra-content">
        {loading ? (
          <div className="ra-loading">
            <Loader2 size={32} className="ra-spinner" />
            <p>데이터를 불러오는 중...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'period' && renderPeriod()}
            {activeTab === 'sentiment' && renderSentiment()}
            {activeTab === 'voc' && renderVoc()}
            {activeTab === 'marketing' && renderMarketing()}
          </>
        )}
      </div>

      {/* 제품 URL 관리 모달 */}
      <ProductUrlManager
        isOpen={showUrlManager}
        onClose={() => setShowUrlManager(false)}
        products={products}
        onRefresh={fetchProducts}
      />
    </main>
  );
}

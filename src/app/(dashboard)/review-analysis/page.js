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
  
  const [dashboardData, setDashboardData] = useState([]);
  const [periodData, setPeriodData] = useState({ periodData: [], reviews: [] });
  const [sentimentData, setSentimentData] = useState({ attributeStats: [], attributeReviews: [] });
  const [vocData, setVocData] = useState([]);
  const [marketingData, setMarketingData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);

  const [selectedVocRow, setSelectedVocRow] = useState(null);
  const [vocDetailFilter, setVocDetailFilter] = useState(null);
  const [vocDetailReviews, setVocDetailReviews] = useState([]);
  const [vocDetailLoading, setVocDetailLoading] = useState(false);

  const [reviewPage, setReviewPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalReviews, setModalReviews] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  
  const [showWordCloudModal, setShowWordCloudModal] = useState(false);
  const [wordCloudData, setWordCloudData] = useState([]);
  
  const dropdownRef = useRef(null);

  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
    fetchProducts();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (selectedProducts.length > 0 && startDate && endDate) {
      fetchTabData(activeTab);
    }
  }, [selectedProducts, startDate, endDate, activeTab, sentimentFilter, selectedAttribute]);

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
          if (sentimentFilter) params.set('sentiment', sentimentFilter);
          const [sentRes, periodRes, vocRes] = await Promise.all([
            fetch(`${base}/sentiment?${params}`),
            fetch(`${base}/period?productIds=${ids}&startDate=${startDate}&endDate=${endDate}&page=1`),
            fetch(`${base}/voc?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`),
          ]);
          const sentJson = await sentRes.json();
          const periodJson = await periodRes.json();
          const vocJson = await vocRes.json();
          setSentimentData(sentJson || { attributeStats: [], attributeReviews: [] });
          if (periodJson?.periodData?.length > 0) setPeriodData(periodJson);
          if (vocJson?.data?.length > 0) setVocData(vocJson.data);
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

  const loadVocDetail = async (row, sentiment) => {
    setVocDetailLoading(true);
    setVocDetailReviews([]);
    try {
      const params = new URLSearchParams({ productIds: row.productId, startDate, endDate, attribute: row.attributeName });
      if (sentiment) params.set('sentiment', sentiment);
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      setVocDetailReviews(data.reviews || []);
    } catch (err) {
      console.error('VoC 상세 로드 실패:', err);
    } finally {
      setVocDetailLoading(false);
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

  const openReviewModal = async (title, pids, attr, sent) => {
    setModalTitle(title);
    setShowReviewModal(true);
    setModalLoading(true);
    setModalReviews([]);
    try {
      const params = new URLSearchParams({ 
        productIds: Array.isArray(pids) ? pids.join(',') : pids, 
        startDate, 
        endDate 
      });
      if (attr) params.set('attribute', attr);
      if (sent) params.set('sentiment', sent);
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      setModalReviews(data.reviews || []);
    } catch (err) {
      console.error('리뷰 팝업 로드 실패:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const openWordCloud = (data) => {
    setWordCloudData(data);
    setShowWordCloudModal(true);
  };

  const toggleProduct = (id) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const removeProduct = (id) => {
    setSelectedProducts(prev => prev.filter(p => p !== id));
  };

  const renderHighlightedText = (text, highlights) => {
    if (!text) return null;
    if (!highlights || highlights.length === 0) return <span>{text}</span>;
    const parts = [];
    let lastIndex = 0;
    const sorted = highlights
      .map(h => ({ ...h, startIdx: text.indexOf(h.text) }))
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

  const renderDashboard = () => {
    if (dashboardData.length === 0) return <div className="ra-empty-state">선택된 제품의 리뷰 데이터가 없습니다.</div>;
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
              <div className="ra-dash-card glass-panel">
                <div className="ra-dash-card-header">
                  {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="ra-dash-thumb" />}
                  <div>
                    <span className="ra-dash-brand">{item.brandName}</span>
                    <h4>{item.productName}</h4>
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
              <div className="ra-dash-card glass-panel">
                <h4>{item.brandName} {item.productName}</h4>
                <div className="ra-sentiment-bars">
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label positive">긍정리뷰비중</span>
                    <div className="ra-bar-track"><div className="ra-bar-fill positive" style={{ width: `${positiveRate}%` }}></div></div>
                    <span className="ra-sentiment-pct positive">{positiveRate}%</span>
                  </div>
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label negative">부정리뷰비중</span>
                    <div className="ra-bar-track"><div className="ra-bar-fill negative" style={{ width: `${negativeRate}%` }}></div></div>
                    <span className="ra-sentiment-pct negative">{negativeRate}%</span>
                  </div>
                </div>
              </div>
              <div className="ra-dash-card glass-panel">
                <h4>TOP 속성</h4>
                <div className="ra-top-attrs">
                   <div className="ra-attr-section">
                     <span className="ra-attr-title positive">TOP3 긍정</span>
                     <span className="ra-attr-values positive">{topPos.slice(0, 3).map(a => a.name).join(', ') || '-'}</span>
                   </div>
                   <div className="ra-attr-section">
                     <span className="ra-attr-title negative">TOP3 부정</span>
                     <span className="ra-attr-values negative">{topNeg.slice(0, 3).map(a => a.name).join(', ') || '-'}</span>
                   </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPeriod = () => {
    const { periodData: pData, reviews } = periodData;
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
      labels: dates.map(d => d.slice(5)),
      datasets: productIdList.map((pid, idx) => ({
        label: productNames[pid],
        data: dates.map(d => dateMap[d]?.[pid] || 0),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        tension: 0.3,
        fill: false,
      })),
    };
    return (
      <div className="ra-period-container">
        <div className="ra-period-left">
          <div className="ra-chart-panel glass-panel">
            <div style={{ height: 350 }}>{dates.length > 0 ? <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} /> : <div className="ra-empty-state">데이터 없음</div>}</div>
          </div>
        </div>
        <div className="ra-period-right">
          <div className="ra-filter-bar">
            {['전체', '긍정', '중립', '부정'].map(lbl => (
              <button key={lbl} className={`ra-filter-chip ${sentimentFilter === (lbl==='전체'?null:lbl==='긍정'?'positive':lbl==='부정'?'negative':'neutral') ? 'active' : ''}`} onClick={() => setSentimentFilter(lbl==='전체'?null:lbl==='긍정'?'positive':lbl==='부정'?'negative':'neutral')}>{lbl}</button>
            ))}
          </div>
          <div className="ra-review-list">
            {reviews.map((r, i) => (
              <div key={i} className="ra-review-item glass-panel">
                <div className="ra-review-header"><span className="ra-review-date">{r.reviewDate}</span><span className={`ra-sentiment-badge ${r.sentiment}`}>{r.sentiment}</span></div>
                <p className="ra-review-text">{renderHighlightedText(r.reviewText, r.sourceHighlight)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSentiment = () => {
    const { periodData: pData } = periodData;
    const dates = [...new Set((pData || []).map(d => d.reviewDate))].sort();
    const productNames = {};
    (pData || []).forEach(d => { productNames[d.productId] = d.productName; });
    const productIdList = Object.keys(productNames);

    const totalChartData = {
      labels: dates.map(d => d.slice(5)),
      datasets: productIdList.map((pid, idx) => ({
        label: productNames[pid],
        data: dates.map(d => (pData || []).find(p => p.reviewDate === d && String(p.productId) === pid)?.count || 0),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        tension: 0.3, fill: false,
      })),
    };

    const productAttrMap = {};
    (vocData || []).forEach(row => {
      const key = String(row.productId);
      if (!productAttrMap[key]) productAttrMap[key] = { productName: row.productName, brandName: row.brandName, attrs: [] };
      productAttrMap[key].attrs.push(row);
    });

    const barChartOpts = {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      scales: { x: { stacked: true, max: 100 }, y: { stacked: true } },
      onClick: (e, el, chart) => {
        if (!el.length) return;
        const { index, datasetIndex } = el[0];
        const attrName = chart.data.labels[index];
        const sent = datasetIndex === 0 ? 'positive' : 'negative';
        openReviewModal(`${attrName} — ${sent==='positive'?'긍정':'부정'}`, chart.canvas.dataset.pids, attrName, sent);
      }
    };

    return (
      <div className="ra-sentiment-container">
        <div className="ra-sentiment-charts">
          <div className="ra-chart-small glass-panel">
             <h4>일별 리뷰 추이</h4>
             <div style={{ height: 220 }}><Line data={totalChartData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
          </div>
        </div>
        <div className="ra-sentiment-header">
           <h3>제품별 속성 분석</h3>
           <div className="ra-filter-bar">
             {['전체','긍정','중립','부정'].map(l => (
               <button key={l} className={`ra-filter-chip ${sentimentFilter===(l==='전체'?null:l==='긍정'?'positive':l==='부정'?'negative':'neutral')?'active':''}`} onClick={()=>setSentimentFilter(l==='전체'?null:l==='긍정'?'positive':l==='부정'?'negative':'neutral')}>{l}</button>
             ))}
           </div>
        </div>
        <div className="ra-sentiment-ratio-list">
           {Object.entries(productAttrMap).map(([pid, {productName, brandName, attrs}]) => {
             const top = attrs.slice(0, 10);
             const barData = {
               labels: top.map(a => a.attributeName),
               datasets: [
                 { label: '긍정', data: top.map(a => a.positiveRate), backgroundColor: '#4A90D9' },
                 { label: '부정', data: top.map(a => a.negativeRate), backgroundColor: '#E8734A' }
               ]
             };
             return (
               <div key={pid} className="ra-sentiment-ratio glass-panel">
                  <div className="ra-sentiment-ratio-header">
                    <p><strong>{brandName}</strong> {productName}</p>
                    <button className="ra-wordcloud-btn" onClick={() => openWordCloud(attrs)}><BarChart3 size={14} /> 버즈량 분석</button>
                  </div>
                  <div style={{ height: Math.max(200, top.length * 30) }}>
                    <Bar data={barData} options={barChartOpts} data-pids={pid} />
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  };

  const renderVoc = () => {
    const vocProductList = products.filter(p => selectedProducts.includes(p.id));
    const activeP = vocProductList[0];
    const filtered = activeP ? vocData.filter(d => d.productId === activeP.id) : [];
    return (
      <div className="ra-voc-container">
        {!activeP ? <div className="ra-empty-state">제품을 선택하세요.</div> : (
          <div className="ra-voc-layout">
            <div className="ra-voc-top-info glass-panel">
              <h3>{activeP.productName} — 심층 VoC 분석</h3>
            </div>
            <div className="ra-voc-main-grid">
               <div className="ra-voc-left-col">
                  <div className="ra-voc-wordcloud-panel glass-panel">
                     <h4>버즈량 분석</h4>
                     <div className="ra-voc-wordcloud-content">
                        {filtered.map((row, idx) => (
                          <span key={idx} className="ra-voc-cloud-item" style={{ fontSize: 12 + (row.totalCount / (filtered[0]?.totalCount || 1)) * 20 }} onClick={() => { setSelectedVocRow(row); loadVocDetail(row, null); }}>{row.attributeName}</span>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="ra-voc-right-col">
                  {selectedVocRow ? (
                    <div className="ra-voc-detail-panel glass-panel">
                       <h4>{selectedVocRow.attributeName} 상세 리뷰</h4>
                       <div className="ra-voc-review-scroll">
                          {vocDetailLoading ? <p>로딩 중...</p> : vocDetailReviews.map((r, i) => (
                            <div key={i} className="ra-voc-review-card">
                               <span className={`ra-sentiment-badge ${r.sentiment}`}>{r.sentiment}</span>
                               <p>{renderHighlightedText(r.reviewText, r.sourceHighlight)}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  ) : <div className="ra-empty-state glass-panel">키워드를 선택하세요.</div>}
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMarketing = () => {
    if (!marketingData || !marketingData.products?.length) return <div className="ra-empty-state">데이터 없음</div>;
    return (
      <div className="ra-marketing-container">
        {marketingData.products.map((p, i) => (
          <div key={i} className="ra-marketing-report glass-panel">
             <h2>{p.productName} 마케팅 리포트</h2>
             <div className="ra-mkt-grid">
                <div className="ra-mkt-section"><h4>페르소나</h4><p>{p.persona?.target}</p></div>
                <div className="ra-mkt-section"><h4>강점</h4><ul>{p.strengths?.map((s,j)=><li key={j}>{s}</li>)}</ul></div>
                <div className="ra-mkt-section"><h4>약점</h4><ul>{p.weaknesses?.map((w,j)=><li key={j}>{w}</li>)}</ul></div>
             </div>
          </div>
        ))}
      </div>
    );
  };

  const renderReviewModal = () => {
    if (!showReviewModal) return null;
    return (
      <div className="ra-modal-overlay" onClick={() => setShowReviewModal(false)}>
        <div className="ra-modal-content glass-panel" onClick={e=>e.stopPropagation()}>
          <div className="ra-modal-header"><h3>{modalTitle}</h3><button onClick={()=>setShowReviewModal(false)}><X size={20}/></button></div>
          <div className="ra-modal-body ra-review-list">
            {modalLoading ? <p>로딩 중...</p> : modalReviews.map((r, i) => (
              <div key={i} className="ra-review-item glass-panel">
                <p>{renderHighlightedText(r.reviewText, r.sourceHighlight)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderWordCloudModal = () => {
    if (!showWordCloudModal) return null;
    return (
      <div className="ra-modal-overlay" onClick={() => setShowWordCloudModal(false)}>
        <div className="ra-modal-content glass-panel" onClick={e=>e.stopPropagation()}>
          <div className="ra-modal-header"><h3>버즈량 상세 분석</h3><button onClick={()=>setShowWordCloudModal(false)}><X size={20}/></button></div>
          <div className="ra-modal-body ra-wordcloud-box">
             {wordCloudData.map((d, i) => (
               <span key={i} className="ra-cloud-tag" style={{ fontSize: 14 + (d.total/10)*5 }} onClick={() => { setShowWordCloudModal(false); openReviewModal(d.name, selectedProducts, d.name, null); }}>{d.name}({d.total})</span>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="container ra-container">
      <header className="ra-header">
        <div className="ra-header-top">
          <h1 className="ra-page-title">리뷰분석</h1>
          <div className="ra-date-range">
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /> ~ <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="ra-product-selector">
          <div className="ra-dropdown-area" ref={dropdownRef}>
            <button className="ra-dropdown-trigger glass-panel" onClick={()=>setShowProductDropdown(!showProductDropdown)}>{selectedProducts.length}개 선택됨 <ChevronDown size={16}/></button>
            {showProductDropdown && <div className="ra-dropdown-menu glass-panel">{products.map(p=>(<label key={p.id}><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={()=>toggleProduct(p.id)}/> {p.productName}</label>))}</div>}
          </div>
        </div>
        <div className="ra-tabs">
          {TABS.map(t => <button key={t.id} className={`ra-tab ${activeTab===t.id?'active':''}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>)}
        </div>
      </header>
      <div className="ra-content">
        {loading ? <div className="ra-loading">로딩 중...</div> : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'period' && renderPeriod()}
            {activeTab === 'sentiment' && renderSentiment()}
            {activeTab === 'voc' && renderVoc()}
            {activeTab === 'marketing' && renderMarketing()}
          </>
        )}
      </div>
      {renderReviewModal()}
      {renderWordCloudModal()}
      <ProductUrlManager isOpen={showUrlManager} onClose={()=>setShowUrlManager(false)} products={products} onRefresh={fetchProducts} />
    </main>
  );
}

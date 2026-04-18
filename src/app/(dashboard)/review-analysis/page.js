'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Calendar, ChevronDown, X, TrendingUp, TrendingDown, BarChart3, MessageSquare, Megaphone, Loader2, Info, ArrowRight } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import ProductUrlManager from './ProductUrlManager';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const TABS = [
  { id: 'dashboard', label: '대시보드', icon: BarChart3 },
  { id: 'period', label: '기간별 분석', icon: TrendingUp },
  { id: 'sentiment', label: '긍/부정 분석', icon: TrendingDown },
  { id: 'voc', label: 'VoC 심층분석', icon: MessageSquare },
  { id: 'marketing', label: 'AI 전략리포트', icon: Megaphone },
];

const CHART_COLORS = ['#9dce63', '#639dce', '#50C878', '#9B59B6', '#F39C12', '#1ABC9C', '#E74C3C', '#3498DB'];

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
  const [vocDetailReviews, setVocDetailReviews] = useState([]);
  const [vocDetailLoading, setVocDetailLoading] = useState(false);

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
    } catch (err) { console.error('제품 로드 실패:', err); }
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
          const params = new URLSearchParams({ productIds: ids, startDate, endDate, page: 1 });
          if (sentimentFilter) params.set('sentiment', sentimentFilter);
          if (selectedAttribute) params.set('attribute', selectedAttribute);
          const res = await fetch(`${base}/period?${params}`);
          const data = await res.json();
          setPeriodData(data || { periodData: [], reviews: [] });
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
          setSentimentData(await sentRes.json());
          setPeriodData(await periodRes.json());
          const vocJson = await vocRes.json();
          setVocData(vocJson.data || []);
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
    } catch (err) { console.error(`${tab} 로드 실패:`, err); }
    finally { setLoading(false); }
  };

  const loadVocDetail = async (row) => {
    setVocDetailLoading(true);
    setVocDetailReviews([]);
    try {
      const params = new URLSearchParams({ productIds: row.productId, startDate, endDate, attribute: row.attributeName });
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      setVocDetailReviews(data.reviews || []);
    } catch (err) { console.error('VoC 상세 로드 실패:', err); }
    finally { setVocDetailLoading(false); }
  };

  const openReviewModal = async (title, pids, attr, sent) => {
    setModalTitle(title);
    setShowReviewModal(true);
    setModalLoading(true);
    setModalReviews([]);
    try {
      const params = new URLSearchParams({ productIds: Array.isArray(pids) ? pids.join(',') : pids, startDate, endDate });
      if (attr) params.set('attribute', attr);
      if (sent) params.set('sentiment', sent);
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      setModalReviews(data.reviews || []);
    } catch (err) { console.error('팝업 로드 실패:', err); }
    finally { setModalLoading(false); }
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
      if (h.startIdx > lastIndex) parts.push({ text: text.slice(lastIndex, h.startIdx), highlight: false });
      if (h.startIdx >= lastIndex) {
        parts.push({ text: h.text, highlight: true, sentiment: h.sentiment, attribute: h.attribute });
        lastIndex = h.startIdx + h.text.length;
      }
    }
    if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), highlight: false });
    return parts.map((p, i) => p.highlight ? <mark key={i} className={`ra-highlight ${p.sentiment}`}>{p.text}</mark> : <span key={i}>{p.text}</span>);
  };

  const renderDashboard = () => {
    if (dashboardData.length === 0) return <div className="ra-empty-state">데이터가 없습니다.</div>;
    return (
      <div className="ra-dashboard-grid">
        {dashboardData.map((item) => {
          const total = parseInt(item.totalReviews) || 0;
          const posRate = total > 0 ? Math.round((parseInt(item.positiveCount) / total) * 100) : 0;
          const negRate = total > 0 ? Math.round((parseInt(item.negativeCount) / total) * 100) : 0;
          return (
            <div key={item.productId} className="ra-dashboard-row glass-panel">
               <div className="ra-dash-card-header">
                 <img src={item.thumbnailUrl} className="ra-dash-thumb" alt="" />
                 <div><span className="ra-dash-brand">{item.brandName}</span><h4>{item.productName}</h4></div>
               </div>
               <div className="ra-dash-stat">
                 <span className="ra-dash-number">{total.toLocaleString()}</span><span className="ra-dash-label">전체 리뷰수</span>
                 <span className={`ra-dash-growth ${item.growthRate >= 0 ? 'positive' : 'negative'}`}>{item.growthRate >= 0 ? '↑' : '↓'} {Math.abs(item.growthRate)}%</span>
               </div>
               <div className="ra-sentiment-bars" style={{ marginTop: '1.5rem' }}>
                  <div className="ra-sentiment-bar"><span className="ra-sentiment-label positive">긍정</span><div className="ra-bar-track"><div className="ra-bar-fill positive" style={{ width: `${posRate}%` }}></div></div><span className="ra-sentiment-pct positive">{posRate}%</span></div>
                  <div className="ra-sentiment-bar"><span className="ra-sentiment-label negative">부정</span><div className="ra-bar-track"><div className="ra-bar-fill negative" style={{ width: `${negRate}%` }}></div></div><span className="ra-sentiment-pct negative">{negRate}%</span></div>
               </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSentiment = () => {
    const productAttrMap = {};
    (vocData || []).forEach(row => {
      const key = String(row.productId);
      if (!productAttrMap[key]) productAttrMap[key] = { productName: row.productName, brandName: row.brandName, attrs: [] };
      productAttrMap[key].attrs.push(row);
    });

    const barOptions = {
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
        <div className="ra-sentiment-header">
          <h3>제품별 속성 분석 <span className="ra-sentiment-guide"><Info size={14}/> 차트 막대를 클릭하여 실제 리뷰를 확인하세요</span></h3>
          <div className="ra-filter-bar">
            {['전체','긍정','중립','부정'].map(lbl => (
              <button key={lbl} className={`ra-filter-chip ${sentimentFilter===(lbl==='전체'?null:lbl==='긍정'?'positive':lbl==='부정'?'negative':'neutral')?'active':''}`} onClick={()=>setSentimentFilter(lbl==='전체'?null:lbl==='긍정'?'positive':lbl==='부정'?'negative':'neutral')}>{lbl}</button>
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
                   <button className="ra-wordcloud-btn" onClick={() => { setWordCloudData(attrs.map(a=>({name:a.attributeName, total:a.totalCount}))); setShowWordCloudModal(true); }}><BarChart3 size={14}/> 버즈량 분석</button>
                </div>
                <div style={{ height: Math.max(250, top.length * 40) }}>
                   <Bar data={barData} options={barOptions} data-pids={pid} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderVoc = () => {
    const activeP = products.find(p => selectedProducts.includes(p.id)) || products[0];
    const filtered = activeP ? vocData.filter(d => d.productId === activeP.id) : [];
    return (
      <div className="ra-voc-container">
        {!activeP ? <div className="ra-empty-state">제품을 선택하세요.</div> : (
          <div className="ra-voc-layout">
            <div className="ra-voc-top-info glass-panel">
              <h3>{activeP.productName} 심층 VoC</h3>
              <p className="ra-voc-subtitle">핵심 키워드를 클릭하여 소비자의 솔직한 목소리를 들어보세요.</p>
            </div>
            <div className="ra-voc-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '2rem' }}>
               <div className="ra-voc-left-col glass-panel">
                 <h4 style={{ marginBottom: '1.5rem' }}>속성별 버즈량 (클릭 가능)</h4>
                 <div className="ra-voc-wordcloud-content">
                    {filtered.sort((a,b)=>b.totalCount-a.totalCount).map((row, idx) => (
                      <span key={idx} className={`ra-voc-cloud-item ${selectedVocRow?.attributeName === row.attributeName ? 'active' : ''}`} style={{ fontSize: 13 + (row.totalCount / (filtered[0]?.totalCount || 1)) * 25 }} onClick={() => { setSelectedVocRow(row); loadVocDetail(row); }}>{row.attributeName} <small style={{ opacity: 0.6 }}>{row.totalCount}</small></span>
                    ))}
                 </div>
               </div>
               <div className="ra-voc-right-col">
                  {selectedVocRow ? (
                    <div className="ra-voc-detail-panel glass-panel">
                       <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><MessageSquare size={18}/> {selectedVocRow.attributeName} 관련 리뷰</h4>
                       <div className="ra-voc-review-scroll">
                          {vocDetailLoading ? <div className="ra-loading"><Loader2 className="ra-spinner"/><span>리뷰 분석 중...</span></div> : vocDetailReviews.map((r, i) => (
                            <div key={i} className="ra-review-item">
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span className={`ra-sentiment-badge ${r.sentiment}`}>{r.sentiment==='positive'?'긍정':r.sentiment==='negative'?'부정':'중립'}</span><span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{r.reviewDate}</span></div>
                               <p className="ra-review-text">{renderHighlightedText(r.reviewText, r.sourceHighlight)}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  ) : <div className="ra-empty-state glass-panel">왼쪽에서 키워드를 선택하여 상세 의견을 확인하세요.</div>}
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMarketing = () => {
    if (!marketingData || !marketingData.products?.length) return <div className="ra-empty-state">데이터를 불러오는 중이거나 없습니다.</div>;
    return (
      <div className="ra-marketing-container">
        {marketingData.products.map((p, i) => (
          <div key={i} className="ra-marketing-report">
             <h2>AI 전략 마케팅 리포트</h2>
             <div className="ra-mkt-report-header">
                <span className="ra-mkt-brand">{p.brandName}</span>
                <span className="ra-mkt-pname">{p.productName}</span>
                <div className="ra-mkt-summary-shield">{p.persona?.target || '전략 수립 중...'}</div>
             </div>
             <div className="ra-mkt-grid">
                <div className="ra-mkt-section">
                   <h4><TrendingUp size={20}/> 핵심 소구점 (강점)</h4>
                   <div className="ra-mkt-card"><ul style={{ paddingLeft: '1.2rem' }}>{p.strengths?.map((s,j)=><li key={j} style={{ marginBottom: '0.8rem' }}>{s}</li>)}</ul></div>
                </div>
                <div className="ra-mkt-section">
                   <h4><TrendingDown size={20}/> 개선 필요 사항 (약점)</h4>
                   <div className="ra-mkt-card"><ul style={{ paddingLeft: '1.2rem' }}>{p.weaknesses?.map((w,j)=><li key={j} style={{ marginBottom: '0.8rem' }}>{w}</li>)}</ul></div>
                </div>
                <div className="ra-mkt-section">
                   <h4><Megaphone size={20}/> 브랜드 액션 플랜</h4>
                   <div className="ra-mkt-action-list">{p.actionPlan?.map((plan, k) => (
                     <div key={k} className="ra-mkt-action-item">
                        <span className="ra-mkt-action-area">{plan.area}</span>
                        <span className="ra-mkt-action-task">{plan.task}</span>
                     </div>
                   ))}</div>
                </div>
             </div>
             <div style={{ marginTop: '3rem' }}>
                <h4 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>추천 콘텐츠 훅</h4>
                <div className="ra-mkt-hooks-grid">{p.contentHooks?.map((hook, m) => (
                   <div key={m} className="ra-mkt-hook-card"><h5>CONTENT HOOK #{m+1}</h5><p>{hook}</p></div>
                ))}</div>
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
        <div className="ra-modal-content" onClick={e=>e.stopPropagation()}>
          <div className="ra-modal-header"><h3>{modalTitle}</h3><button onClick={()=>setShowReviewModal(false)}><X size={20}/></button></div>
          <div className="ra-modal-body">
            {modalLoading ? <div className="ra-loading"><Loader2 className="ra-spinner"/><span>리뷰 데이터 로드 중...</span></div> : modalReviews.map((r, i) => (
              <div key={i} className="ra-review-item glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}><span className={`ra-sentiment-badge ${r.sentiment}`}>{r.sentiment}</span><span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{r.reviewDate}</span></div>
                <p className="ra-review-text">{renderHighlightedText(r.reviewText, r.sourceHighlight)}</p>
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
        <div className="ra-modal-content" onClick={e=>e.stopPropagation()}>
          <div className="ra-modal-header"><h3>데이터 기반 버즈량 상세 분석</h3><button onClick={()=>setShowWordCloudModal(false)}><X size={20}/></button></div>
          <div className="ra-modal-body ra-wordcloud-box">
             {wordCloudData.map((d, i) => (
               <span key={i} className="ra-cloud-tag" style={{ fontSize: 16 + (d.total/10)*8, fontWeight: 700, color: CHART_COLORS[i % CHART_COLORS.length] }} onClick={() => { setShowWordCloudModal(false); openReviewModal(d.name, selectedProducts, d.name, null); }}>{d.name}</span>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="container ra-container">
      <header className="ra-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div><h1 className="ra-page-title">리워드 & VoC 마켓 인사이트</h1><p style={{ color: 'var(--text-dim)' }}>애경 브랜드의 시장 경쟁력을 AI로 실시간 분석합니다.</p></div>
          <div className="ra-date-range"><Calendar size={18}/><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /> ~ <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
        </div>
        <div className="ra-product-selector" ref={dropdownRef}>
           <div style={{ position: 'relative' }}>
              <button className="ra-dropdown-trigger glass-panel" onClick={()=>setShowProductDropdown(!showProductDropdown)}>{selectedProducts.length}개 제품 분석 중 <ChevronDown size={18}/></button>
              {showProductDropdown && <div className="ra-dropdown-menu glass-panel">{products.map(p=>(<label key={p.id}><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={()=>setSelectedProducts(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev, p.id])}/> {p.productName}</label>))}</div>}
           </div>
        </div>
        <div className="ra-tabs">
          {TABS.map(t => <button key={t.id} className={`ra-tab ${activeTab===t.id?'active':''}`} onClick={()=>setActiveTab(t.id)}><t.icon size={18}/> {t.label}</button>)}
        </div>
      </header>
      <div className="ra-content">
        {loading ? <div className="ra-loading"><Loader2 className="ra-spinner" size={40}/><span>데이터를 심층 분석하고 있습니다...</span></div> : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
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

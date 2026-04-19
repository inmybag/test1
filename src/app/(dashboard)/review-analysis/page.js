'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Calendar, ChevronDown, X, TrendingUp, TrendingDown, BarChart3, MessageSquare, Megaphone, Loader2, Star, Lock, ExternalLink } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import ProductUrlManager from './ProductUrlManager';


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const TABS = [
  { id: 'dashboard', label: '대시보드', icon: BarChart3 },
  { id: 'period', label: '기간별 분석', icon: TrendingUp },
  { id: 'sentiment', label: '긍/부정 분석', icon: TrendingDown },
  { id: 'voc', label: 'VoC 분석', icon: MessageSquare },
  { id: 'marketing', label: 'AI 전략리포트', icon: Megaphone },
];

const CHART_COLORS = ['#9dce63', '#639dce', '#50C878', '#9B59B6', '#F39C12', '#1ABC9C', '#E74C3C', '#3498DB'];

const DARK_CHART_DEFAULTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#e2e8f0', font: { size: 10 } } } },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true },
  },
};

export default function ReviewAnalysisPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showUrlManager, setShowUrlManager] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 탭별 데이터
  const [dashboardData, setDashboardData] = useState([]);
  const dashboardDataRef = useRef([]);  // marketing 렌더링 시 즉시 참조용
  const setDashAndRef = (data) => { dashboardDataRef.current = data; setDashboardData(data); };
  const [periodData, setPeriodData] = useState({ periodData: [], reviews: [] });
  const [vocData, setVocData] = useState([]);
  const [marketingData, setMarketingData] = useState(null);
  const [marketingOverrides, setMarketingOverrides] = useState({});

  const [loading, setLoading] = useState(false);

  const [sentimentFilter, setSentimentFilter] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState([]);
  const [chartFilterDate, setChartFilterDate] = useState(null);
  const [chartFilterPid, setChartFilterPid] = useState(null);

  // 기간별 분석 무한 스크롤
  const [periodPage, setPeriodPage] = useState(1);
  const [periodHasMore, setPeriodHasMore] = useState(false);
  const [periodLoadingMore, setPeriodLoadingMore] = useState(false);
  const periodSentinelRef = useRef(null);
  const periodScrollRef = useRef(null);

  // VoC 상세
  const [selectedVocRow, setSelectedVocRow] = useState(null);
  const [vocDetailFilter, setVocDetailFilter] = useState(null);
  const [vocDetailReviews, setVocDetailReviews] = useState([]);
  const [vocDetailLoading, setVocDetailLoading] = useState(false);
  const [vocPage, setVocPage] = useState(1);
  const [vocHasMore, setVocHasMore] = useState(false);
  const [vocLoadingMore, setVocLoadingMore] = useState(false);
  const vocScrollRef = useRef(null);
  const vocHasMoreRef = useRef(false);
  const vocLoadingMoreRef = useRef(false);
  const vocPageRef = useRef(1);
  const loadVocDetailRef = useRef(null);
  const selectedVocRowRef = useRef(null);
  const vocDetailFilterRef = useRef(null);

  // 리뷰 팝업 모달
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalReviews, setModalReviews] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [modalHasMore, setModalHasMore] = useState(false);
  const [modalLoadingMore, setModalLoadingMore] = useState(false);
  const modalScrollRef = useRef(null);
  const modalHasMoreRef = useRef(false);
  const modalLoadingMoreRef = useRef(false);
  const modalPageRef = useRef(1);
  const loadModalReviewsRef = useRef(null);
  const modalParamsRef = useRef({ pids: [], attr: null, sent: null });

  // 워드클라우드 모달
  const [showWordCloudModal, setShowWordCloudModal] = useState(false);
  const [wordCloudData, setWordCloudData] = useState([]);
  const [wordCloudPid, setWordCloudPid] = useState(null);

  // AI 재생성 모달
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenError, setRegenError] = useState('');
  const [regenTargetPid, setRegenTargetPid] = useState(null);

  // Notion
  const [notionSendingPids, setNotionSendingPids] = useState(new Set());
  const [notionUrls, setNotionUrls] = useState({});

  const dropdownRef = useRef(null);

  useEffect(() => {
    const now = new Date();
    const ed = now.toISOString().split('T')[0];
    const sd = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    setStartDate(sd);
    setEndDate(ed);
    fetchProducts();
  }, []);

  // dashboardData 변경 시 ref 자동 동기화
  useEffect(() => { dashboardDataRef.current = dashboardData; }, [dashboardData]);

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    const anyOpen = showReviewModal || showWordCloudModal || showRegenModal;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showReviewModal, showWordCloudModal, showRegenModal]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowProductDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 탭 전환 / 제품 / 날짜 변경 → 전체 데이터 재조회
  useEffect(() => {
    if (selectedProducts.length > 0 && startDate && endDate) {
      fetchTabData(activeTab);
    }
  }, [selectedProducts, startDate, endDate, activeTab]);

  // 기간별 분석: 필터/차트클릭 변경 → 리뷰 초기화 후 1페이지 재조회
  useEffect(() => {
    if (activeTab === 'period' && selectedProducts.length > 0 && startDate && endDate) {
      setPeriodPage(1);
      setPeriodHasMore(false);
      loadPeriodReviews(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1, true);
    }
  }, [sentimentFilter, selectedAttribute, chartFilterDate, chartFilterPid]);

  // 무한 스크롤 — ref로 최신 상태/함수 추적 (stale closure 방지)
  const periodHasMoreRef = useRef(false);
  const periodLoadingMoreRef = useRef(false);
  const periodPageRef = useRef(1);
  const loadPeriodReviewsRef = useRef(null);

  useEffect(() => { periodHasMoreRef.current = periodHasMore; }, [periodHasMore]);
  useEffect(() => { periodLoadingMoreRef.current = periodLoadingMore; }, [periodLoadingMore]);
  useEffect(() => { periodPageRef.current = periodPage; }, [periodPage]);

  useEffect(() => { vocHasMoreRef.current = vocHasMore; }, [vocHasMore]);
  useEffect(() => { vocLoadingMoreRef.current = vocLoadingMore; }, [vocLoadingMore]);
  useEffect(() => { vocPageRef.current = vocPage; }, [vocPage]);
  useEffect(() => { selectedVocRowRef.current = selectedVocRow; }, [selectedVocRow]);
  useEffect(() => { vocDetailFilterRef.current = vocDetailFilter; }, [vocDetailFilter]);

  useEffect(() => { modalHasMoreRef.current = modalHasMore; }, [modalHasMore]);
  useEffect(() => { modalLoadingMoreRef.current = modalLoadingMore; }, [modalLoadingMore]);
  useEffect(() => { modalPageRef.current = modalPage; }, [modalPage]);

  // 스크롤 리스너 — activeTab이 period일 때 컨테이너에 부착
  useEffect(() => {
    if (activeTab !== 'period') return;
    const container = periodScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (periodLoadingMoreRef.current || !periodHasMoreRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        periodLoadingMoreRef.current = true;
        const nextPage = periodPageRef.current + 1;
        periodPageRef.current = nextPage;
        setPeriodPage(nextPage);
        loadPeriodReviewsRef.current?.(undefined, undefined, undefined, undefined, undefined, undefined, undefined, nextPage, false);
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // 컨테이너가 스크롤 없이 꽉 안 찬 경우 자동 추가 로드
  useEffect(() => {
    if (!periodHasMore || periodLoadingMore || activeTab !== 'period') return;
    const container = periodScrollRef.current;
    if (!container) return;
    if (container.scrollHeight <= container.clientHeight + 10) {
      const nextPage = periodPageRef.current + 1;
      periodPageRef.current = nextPage;
      setPeriodPage(nextPage);
      loadPeriodReviewsRef.current?.(undefined, undefined, undefined, undefined, undefined, undefined, undefined, nextPage, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodHasMore, periodLoadingMore]);

  // VoC/모달 무한 스크롤 — auto-load (컨테이너가 꽉 안 찬 경우)
  useEffect(() => {
    if (!vocHasMore || vocLoadingMore || activeTab !== 'voc') return;
    const container = vocScrollRef.current;
    if (!container) return;
    if (container.scrollHeight <= container.clientHeight + 10) {
      const nextPage = vocPageRef.current + 1;
      vocPageRef.current = nextPage;
      setVocPage(nextPage);
      loadVocDetailRef.current?.(selectedVocRowRef.current, vocDetailFilterRef.current, nextPage, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocHasMore, vocLoadingMore]);

  useEffect(() => {
    if (!modalHasMore || modalLoadingMore || !showReviewModal) return;
    const container = modalScrollRef.current;
    if (!container) return;
    if (container.scrollHeight <= container.clientHeight + 10) {
      const nextPage = modalPageRef.current + 1;
      modalPageRef.current = nextPage;
      setModalPage(nextPage);
      const { pids, attr, sent } = modalParamsRef.current;
      loadModalReviewsRef.current?.(pids, attr, sent, nextPage, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalHasMore, modalLoadingMore]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/reviews/products');
      const { data } = await res.json();
      setProducts(data || []);
    } catch (err) { console.error('제품 로드 실패:', err); }
  };

  const removeProduct = (id) => setSelectedProducts(prev => prev.filter(p => p !== id));

  const fetchTabData = async (tab, opts = {}) => {
    if (!selectedProducts.length) return;
    setLoading(true);
    const ids = selectedProducts.join(',');
    const base = '/api/reviews';
    try {
      switch (tab) {
        case 'dashboard': {
          const res = await fetch(`${base}/dashboard?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`);
          const { data } = await res.json();
          setDashAndRef(data || []);
          break;
        }
        case 'period': {
          const params = new URLSearchParams({ productIds: ids, startDate, endDate, page: 1 });
          if (sentimentFilter) params.set('sentiment', sentimentFilter);
          if (selectedAttribute && selectedAttribute.length > 0) params.set('attribute', selectedAttribute.join(','));
          const [periodRes, vocRes] = await Promise.all([
            fetch(`${base}/period?${params}`),
            fetch(`${base}/voc?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`),
          ]);
          const periodJson = await periodRes.json();
          const vocJson = await vocRes.json();
          setPeriodData({ periodData: periodJson.periodData || [], reviews: [] });
          setVocData(vocJson.data || []);
          // 리뷰는 별도로 로드 (1페이지, replace)
          setPeriodPage(1);
          setPeriodHasMore(false);
          await loadPeriodReviews(ids, startDate, endDate, sentimentFilter, selectedAttribute, chartFilterDate, chartFilterPid, 1, true);
          break;
        }
        case 'sentiment': {
          const params = new URLSearchParams({ productIds: ids, startDate, endDate });
          const [periodRes, vocRes] = await Promise.all([
            fetch(`${base}/period?productIds=${ids}&startDate=${startDate}&endDate=${endDate}&page=1`),
            fetch(`${base}/voc?${params}`),
          ]);
          const periodJson = await periodRes.json();
          setPeriodData(periodJson);
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
          // 대시보드데이터 없으면 먹저 로드한 뒤 marketing 요청
          let freshDash = dashboardDataRef.current;
          if (!freshDash.length) {
            const dRes = await fetch(`${base}/dashboard?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`);
            const dJson = await dRes.json();
            freshDash = dJson.data || [];
            setDashAndRef(freshDash);
          }
          if (opts.force && opts.productId) {
            const url = `${base}/marketing?productIds=${opts.productId}&startDate=${startDate}&endDate=${endDate}&force=true`;
            const res = await fetch(url);
            const json = await res.json();
            const prod = json.data?.products?.[0];
            if (prod) {
              setMarketingOverrides(prev => ({ ...prev, [opts.productId]: { ...prod, updatedAt: json.updatedAt } }));
            }
          } else {
            const url = `${base}/marketing?productIds=${ids}&startDate=${startDate}&endDate=${endDate}`;
            const res = await fetch(url);
            const json = await res.json();
            setMarketingData(json.data ? { ...json.data, cached: json.cached, updatedAt: json.updatedAt } : null);
          }
          break;
        }
      }
    } catch (err) { console.error(`${tab} 로드 실패:`, err); }
    finally { setLoading(false); }
  };

  const loadPeriodReviews = async (
    ids = selectedProducts.join(','),
    sd = startDate,
    ed = endDate,
    sentFilter = sentimentFilter,
    attrFilter = selectedAttribute,
    cfDate = chartFilterDate,
    cfPid = chartFilterPid,
    page = 1,
    replace = true
  ) => {
    const pid = cfPid ? String(cfPid) : ids;
    const rsd = cfDate || sd;
    const red = cfDate || ed;
    const params = new URLSearchParams({ productIds: pid, startDate: rsd, endDate: red, page });
    if (sentFilter) params.set('sentiment', sentFilter);
    if (attrFilter && attrFilter.length > 0) params.set('attribute', Array.isArray(attrFilter) ? attrFilter.join(',') : attrFilter);
    if (page > 1) setPeriodLoadingMore(true);
    try {
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      const fetched = data.reviews || [];
      setPeriodHasMore(fetched.length === 10); // 10건 미만이면 마지막 페이지
      setPeriodData(prev => ({
        ...prev,
        reviews: replace ? fetched : [...(prev.reviews || []), ...fetched],
      }));
    } catch (err) { console.error('리뷰 로드 실패:', err); }
    finally { setPeriodLoadingMore(false); }
  };
  // 항상 최신 함수 참조 유지
  loadPeriodReviewsRef.current = loadPeriodReviews;

  const loadVocDetail = async (row, sentiment, page = 1, replace = true) => {
    if (!row) return;
    if (replace) {
      setVocDetailLoading(true);
      setVocDetailReviews([]);
      setVocPage(1);
      setVocHasMore(false);
      vocPageRef.current = 1;
    } else {
      setVocLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({ productIds: row.productId, startDate, endDate, attribute: row.attributeName, page });
      if (sentiment) params.set('sentiment', sentiment);
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      const fetched = data.reviews || [];
      setVocHasMore(fetched.length === 10);
      setVocDetailReviews(prev => replace ? fetched : [...prev, ...fetched]);
    } catch (err) { console.error('VoC 상세 로드 실패:', err); }
    finally { setVocDetailLoading(false); setVocLoadingMore(false); }
  };
  loadVocDetailRef.current = loadVocDetail;

  const loadModalReviews = async (pids, attr, sent, page = 1, replace = true) => {
    if (replace) {
      setModalLoading(true);
      setModalReviews([]);
      setModalPage(1);
      setModalHasMore(false);
      modalPageRef.current = 1;
    } else {
      setModalLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({ productIds: Array.isArray(pids) ? pids.join(',') : String(pids), startDate, endDate, page });
      if (attr) params.set('attribute', attr);
      if (sent) params.set('sentiment', sent);
      const res = await fetch(`/api/reviews/period?${params}`);
      const data = await res.json();
      const fetched = data.reviews || [];
      setModalHasMore(fetched.length === 10);
      setModalReviews(prev => replace ? fetched : [...prev, ...fetched]);
    } catch (err) { console.error('팝업 로드 실패:', err); }
    finally { setModalLoading(false); setModalLoadingMore(false); }
  };
  loadModalReviewsRef.current = loadModalReviews;

  const openReviewModal = async (title, pids, attr, sent) => {
    modalParamsRef.current = { pids, attr, sent };
    modalHasMoreRef.current = false;
    modalLoadingMoreRef.current = false;
    setModalTitle(title);
    setShowReviewModal(true);
    await loadModalReviews(pids, attr, sent, 1, true);
  };

  const handleRegenSubmit = () => {
    if (regenPassword !== 'youngje') {
      setRegenError('비밀번호가 올바르지 않습니다.');
      return;
    }
    setShowRegenModal(false);
    setRegenPassword('');
    setRegenError('');
    if (regenTargetPid) {
      fetchTabData('marketing', { force: true, productId: regenTargetPid });
    }
  };

  const sendToNotion = async (product) => {
    const pid = product.productId;
    setNotionSendingPids(prev => new Set([...prev, pid]));
    try {
      const res = await fetch('/api/notion/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, startDate, endDate }),
      });
      const result = await res.json();
      if (result.success) {
        setNotionUrls(prev => ({ ...prev, [pid]: result.url }));
        alert('🚀 마케팅부문 노션 페이지로 성공적으로 전송되었습니다!');
      } else {
        alert('❌ 노션 전송 오류: ' + result.error);
      }
    } catch (err) {
      alert('❌ 노션 전송 중 네트워크 오류가 발생했습니다.');
    } finally {
      setNotionSendingPids(prev => { const s = new Set(prev); s.delete(pid); return s; });
    }
  };

  // 마케팅 데이터에서 productId 기반 override 적용
  const getMktProduct = (p) => {
    const pid = p.productId;
    if (pid && marketingOverrides[pid]) return { ...p, ...marketingOverrides[pid] };
    return p;
  };

  // ── 리뷰 카드 (공통) ──────────────────────────────
  const renderHighlightedText = (text, highlights) => {
    if (!text) return null;
    if (!highlights || !highlights.length) return <span>{text}</span>;
    const sorted = highlights
      .map(h => ({ ...h, startIdx: text.indexOf(h.text) }))
      .filter(h => h.startIdx >= 0)
      .sort((a, b) => a.startIdx - b.startIdx);
    const parts = [];
    let lastIndex = 0;
    for (const h of sorted) {
      if (h.startIdx > lastIndex) parts.push({ text: text.slice(lastIndex, h.startIdx), highlight: false });
      if (h.startIdx >= lastIndex) {
        parts.push({ text: h.text, highlight: true, sentiment: h.sentiment, attribute: h.attribute });
        lastIndex = h.startIdx + h.text.length;
      }
    }
    if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), highlight: false });
    return parts.map((p, i) => p.highlight
      ? <mark key={i} className={`ra-highlight ${p.sentiment}`} title={`${p.attribute} — ${p.sentiment}`}>{p.text}</mark>
      : <span key={i}>{p.text}</span>);
  };

  const renderReviewCard = (r, i) => {
    const optionText = r.extraInfo?.option || (typeof r.extraInfo === 'string' ? r.extraInfo : null);
    const mediaUrls = Array.isArray(r.mediaUrls) ? r.mediaUrls.filter(Boolean) : [];
    return (
      <div key={i} className="ra-review-item glass-panel">
        {/* 속성 태그 — 상단 */}
        {(r.attributes || []).length > 0 && (
          <div className="ra-review-attrs" style={{ marginBottom: '0.6rem' }}>
            {r.attributes.map((attr, ai) => (
              <span key={ai} className={`ra-review-attr-tag ${attr.sentiment}`}>
                {attr.name} — {attr.sentiment === 'positive' ? '긍정' : attr.sentiment === 'negative' ? '부정' : '중립'}
              </span>
            ))}
          </div>
        )}
        <div className="ra-review-meta">
          <span className="ra-review-date">{r.reviewDate}</span>
          <span className={`ra-sentiment-badge ${r.sentiment}`}>
            {r.sentiment === 'positive' ? '긍정' : r.sentiment === 'negative' ? '부정' : '중립'}
          </span>
          {r.rating && (
            <span className="ra-review-rating"><Star size={13} fill="#fbbf24" /> {r.rating}</span>
          )}
          {r.platform && <span className="ra-review-platform">{r.platform}</span>}
          {r.brandName && <span className="ra-review-brand-tag">{r.brandName}</span>}
          {r.productName && <span className="ra-review-pname-tag">{r.productName}</span>}
        </div>
        {r.reviewerNickname && (
          <div className="ra-review-author">작성자: {r.reviewerNickname}</div>
        )}
        {optionText && (
          <div className="ra-review-option">option: {optionText}</div>
        )}
        <p className="ra-review-text">{renderHighlightedText(r.reviewText, r.sourceHighlight)}</p>
        {mediaUrls.length > 0 && (
          <div className="ra-review-media">
            {mediaUrls.slice(0, 4).map((url, mi) => (
              <img key={mi} src={url} alt="" onError={e => { e.target.style.display = 'none'; }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── 대시보드 ──────────────────────────────────────
  const renderDashboard = () => {
    if (!dashboardData.length) return <div className="ra-empty-state">제품을 선택하면 데이터가 표시됩니다.</div>;
    return (
      <div className="ra-dashboard-grid">
        {dashboardData.map(item => {
          const total = parseInt(item.totalReviews) || 0;
          const pos = parseInt(item.positiveCount) || 0;
          const neg = parseInt(item.negativeCount) || 0;
          const neu = parseInt(item.neutralCount) || 0;
          const posRate = total > 0 ? Math.round(pos / total * 100) : 0;
          const negRate = total > 0 ? Math.round(neg / total * 100) : 0;
          const neuRate = total > 0 ? Math.round(neu / total * 100) : 0;
          const todayCount = parseInt(item.todayCount) || 0;
          const allTimeCount = parseInt(item.allTimeCount) || 0;
          const topPos = item.topAttributes?.positive || [];
          const topNeg = item.topAttributes?.negative || [];
          const p = products.find(prod => String(prod.id) === String(item.productId));
          return (
            <div key={item.productId} className="ra-dashboard-row">
              <div className="ra-dash-card glass-panel">
                <div className="ra-dash-card-header">
                  {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="ra-dash-thumb" />}
                  <div>
                    <span className="ra-dash-brand">{item.brandName}</span>
                    <h4>{item.productName}</h4>
                    {p?.pageUrl && <a href={p.pageUrl} target="_blank" rel="noreferrer" className="ra-external-link">상품 상세 보기 ↗</a>}
                  </div>
                </div>
                <div className="ra-dash-stat">
                  <span className="ra-dash-number">{total.toLocaleString()}</span>
                  <span className="ra-dash-label">신규 리뷰수</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  <span style={{ color: '#9dce63' }}>금일 <strong>{todayCount}</strong>건</span>
                  <span style={{ color: '#94a3b8' }}>누적 <strong>{allTimeCount.toLocaleString()}</strong>건</span>
                </div>
              </div>
              <div className="ra-dash-card glass-panel">
                <h4>{item.brandName} {item.productName}</h4>
                <div className="ra-sentiment-bars">
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label positive">긍정</span>
                    <div className="ra-bar-track"><div className="ra-bar-fill positive" style={{ width: `${posRate}%` }} /></div>
                    <span className="ra-sentiment-pct positive">{posRate}%</span>
                  </div>
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label neutral">중립</span>
                    <div className="ra-bar-track"><div className="ra-bar-fill neutral" style={{ width: `${neuRate}%` }} /></div>
                    <span className="ra-sentiment-pct neutral">{neuRate}%</span>
                  </div>
                  <div className="ra-sentiment-bar">
                    <span className="ra-sentiment-label negative">부정</span>
                    <div className="ra-bar-track"><div className="ra-bar-fill negative" style={{ width: `${negRate}%` }} /></div>
                    <span className="ra-sentiment-pct negative">{negRate}%</span>
                  </div>
                </div>
                {item.avgRating && <div className="ra-avg-rating">평균 ★ {item.avgRating}</div>}
              </div>
              <div className="ra-dash-card glass-panel">
                <h4>{item.brandName} {item.productName}</h4>
                <div className="ra-top-attrs">
                  <div className="ra-attr-section">
                    <span className="ra-attr-title positive">TOP3 긍정 속성</span>
                    <span className="ra-attr-values positive">{topPos.length ? topPos.slice(0, 3).map(a => a.name).join(', ') : '-'}</span>
                  </div>
                  <div className="ra-attr-section">
                    <span className="ra-attr-title negative">TOP3 부정 속성</span>
                    <span className="ra-attr-values negative">{topNeg.length ? topNeg.slice(0, 3).map(a => a.name).join(', ') : '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── 기간별 분석 ───────────────────────────────────
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
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + '22',
        tension: 0.3, fill: false, pointRadius: 4, pointHoverRadius: 7,
      })),
    };

    const lineOpts = {
      ...DARK_CHART_DEFAULTS,
      plugins: {
        ...DARK_CHART_DEFAULTS.plugins,
        legend: { labels: { color: '#e2e8f0', font: { size: 10 } } },
        title: { display: true, text: '일자별 리뷰 생성 수', color: '#f8fafc', font: { size: 14, weight: 'bold' } },
      },
      onClick: (_event, elements) => {
        if (!elements.length) {
          setChartFilterDate(null);
          setChartFilterPid(null);
          return;
        }
        const el = elements[0];
        const clickedDate = dates[el.index];
        const clickedPid = parseInt(productIdList[el.datasetIndex]);
        setChartFilterDate(clickedDate);
        setChartFilterPid(clickedPid);
      },
    };

    // 속성 칩: vocData를 전체 집계
    const attrAgg = {};
    (vocData || []).forEach(row => {
      const name = row.attributeName;
      if (!attrAgg[name]) attrAgg[name] = { totalCount: 0, positiveCount: 0, negativeCount: 0 };
      attrAgg[name].totalCount += parseInt(row.totalCount) || 0;
      attrAgg[name].positiveCount += parseInt(row.positiveCount) || 0;
      attrAgg[name].negativeCount += parseInt(row.negativeCount) || 0;
    });
    const attrChips = Object.entries(attrAgg)
      .map(([name, c]) => ({ name, count: c.totalCount }))
      .filter(a => a.count > 0)
      .sort((a, b) => b.count - a.count);

    const clearChartFilter = () => { setChartFilterDate(null); setChartFilterPid(null); };

    return (
      <div className="ra-period-container">
        <div className="ra-period-left" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)' }}>
          <div className="ra-chart-panel glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: 320, flexShrink: 0 }}>
              {dates.length > 0
                ? <Line data={lineChartData} options={lineOpts} />
                : <div className="ra-empty-state">차트 데이터가 없습니다.</div>
              }
            </div>
            {attrChips.length > 0 && (
              <div className="ra-attr-chips" style={{ flex: 1, overflowY: 'auto' }}>
                {attrChips.map(({ name, count }) => (
                  <button
                    key={name}
                    className={`ra-attr-chip ${(selectedAttribute || []).includes(name) ? 'active' : ''}`}
                    onClick={() => setSelectedAttribute(prev => {
                      const arr = prev || [];
                      return arr.includes(name) ? arr.filter(n => n !== name) : [...arr, name];
                    })}
                  >
                    {name} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div ref={periodScrollRef} className="ra-period-right" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <div className="ra-filter-bar">
              {['전체', '긍정', '중립', '부정'].map(label => {
                const val = label === '전체' ? null : label === '긍정' ? 'positive' : label === '부정' ? 'negative' : 'neutral';
                return (
                  <button
                    key={label}
                    className={`ra-filter-chip ${sentimentFilter === val ? 'active' : ''}`}
                    onClick={() => setSentimentFilter(val)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {(chartFilterDate || chartFilterPid) && (
              <button className="ra-chart-filter-badge" onClick={clearChartFilter}>
                {chartFilterDate && `${chartFilterDate.slice(5)}`}
                {chartFilterPid && ` · ${productNames[chartFilterPid] || ''}`}
                <X size={12} />
              </button>
            )}
          </div>
          <div className="ra-review-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.2rem' }}>
            {(reviews || []).map((r, i) => renderReviewCard(r, i))}
            {(!reviews || !reviews.length) && (
              <div className="ra-empty-state">
                {chartFilterDate ? '해당 날짜의 리뷰가 없습니다.' : '리뷰 데이터가 없습니다.'}
              </div>
            )}
            {/* 무한 스크롤 sentinel */}
            <div ref={periodSentinelRef} style={{ height: 1 }} />
            {periodLoadingMore && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                <Loader2 size={18} className="ra-spinner" style={{ display: 'inline-block', marginRight: '0.4rem' }} />
                더 불러오는 중...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 긍/부정 분석 ──────────────────────────────────
  const renderSentiment = () => {
    const { periodData: pData } = periodData;
    const dates = [...new Set((pData || []).map(d => d.reviewDate))].sort();
    const productNames = {};
    (pData || []).forEach(d => { productNames[d.productId] = d.productName; });

    // 제품별 속성 맵 (vocData)
    const productAttrMap = {};
    (vocData || []).forEach(row => {
      const key = String(row.productId);
      if (!productAttrMap[key]) productAttrMap[key] = { productName: row.productName, brandName: row.brandName, attrs: [] };
      productAttrMap[key].attrs.push(row);
    });

    const makeProductLineData = (pid) => ({
      labels: dates.map(d => d.slice(5)),
      datasets: [
        {
          label: '전체',
          data: dates.map(d => {
            const item = (pData || []).find(p => p.reviewDate === d && String(p.productId) === String(pid));
            return item ? parseInt(item.count) : 0;
          }),
          borderColor: '#9dce63', tension: 0.3, fill: false, pointRadius: 3,
        },
        {
          label: '긍정',
          data: dates.map(d => {
            const item = (pData || []).find(p => p.reviewDate === d && String(p.productId) === String(pid));
            return item ? parseInt(item.positiveCount) : 0;
          }),
          borderColor: '#60a5fa', tension: 0.3, fill: false, pointRadius: 3,
        },
        {
          label: '부정',
          data: dates.map(d => {
            const item = (pData || []).find(p => p.reviewDate === d && String(p.productId) === String(pid));
            return item ? parseInt(item.negativeCount) : 0;
          }),
          borderColor: '#f87171', tension: 0.3, fill: false, pointRadius: 3,
        },
      ],
    });

    const makeBarOpts = (pid) => ({
      ...DARK_CHART_DEFAULTS,
      indexAxis: 'y',
      scales: {
        x: { stacked: true, max: 100, ticks: { color: '#94a3b8', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { stacked: true, ticks: { color: '#e2e8f0', font: { size: 10 } }, grid: { display: false } },
      },
      onClick: (_e, el, chart) => {
        if (!el.length) return;
        const attrName = chart.data.labels[el[0].index];
        const sent = el[0].datasetIndex === 0 ? 'positive' : 'negative';
        openReviewModal(`${attrName} — ${sent === 'positive' ? '긍정' : '부정'}`, [parseInt(pid)], attrName, sent);
      },
    });

    const lineOpts = {
      ...DARK_CHART_DEFAULTS,
      plugins: { legend: { labels: { color: '#e2e8f0', font: { size: 9 } } } },
    };

    const productIds = [...new Set([
      ...Object.keys(productNames),
      ...Object.keys(productAttrMap),
    ])];

    if (!productIds.length) return <div className="ra-empty-state">제품을 선택하면 데이터가 표시됩니다.</div>;

    return (
      <div className="ra-sentiment-container">
        {productIds.map(pid => {
          const info = productAttrMap[pid] || { productName: productNames[pid] || '', brandName: '', attrs: [] };
          const top = info.attrs.slice(0, 10);
          const barData = {
            labels: top.map(a => a.attributeName),
            datasets: [
              { label: '긍정', data: top.map(a => a.positiveRate || 0), backgroundColor: '#4A90D9' },
              { label: '부정', data: top.map(a => a.negativeRate || 0), backgroundColor: '#E8734A' },
            ],
          };
          return (
            <div key={pid}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ margin: 0, fontWeight: 800, color: '#fff' }}>
                  <span className="ra-dash-brand" style={{ marginRight: '0.5rem' }}>{info.brandName}</span>
                  {info.productName}
                </p>
                <button
                  className="ra-wordcloud-btn"
                  onClick={() => {
                    const words = info.attrs
                      .map(a => ({ text: a.attributeName, value: parseInt(a.totalCount) || 1 }))
                      .filter(w => w.value > 0);
                    setWordCloudData(words);
                    setWordCloudPid(parseInt(pid));
                    setShowWordCloudModal(true);
                  }}
                >
                  <BarChart3 size={14} /> 버즈량
                </button>
              </div>
              <div className="ra-sentiment-product-pair">
                <div className="ra-chart-small glass-panel">
                  <div style={{ height: Math.max(200, top.length > 0 ? 220 : 200) }}>
                    {dates.length > 0
                      ? <Line data={makeProductLineData(pid)} options={lineOpts} />
                      : <div className="ra-empty-state">데이터 없음</div>
                    }
                  </div>
                </div>
                <div className="ra-chart-small glass-panel">
                  <div style={{ height: Math.max(200, top.length * 36 + 20) }}>
                    {top.length > 0
                      ? <Bar data={barData} options={makeBarOpts(pid)} />
                      : <div className="ra-empty-state">속성 데이터 없음</div>
                    }
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── VoC 분석 ──────────────────────────────────────
  const renderVoc = () => {
    // 제품별 그룹화
    const productGroups = {};
    (vocData || []).forEach(row => {
      const key = String(row.productId);
      if (!productGroups[key]) productGroups[key] = { brandName: row.brandName, productName: row.productName, rows: [] };
      productGroups[key].rows.push(row);
    });

    if (!Object.keys(productGroups).length) return <div className="ra-empty-state">VoC 데이터가 없습니다.</div>;

    return (
      <div className="ra-voc-layout">
        <div className="ra-voc-table-panel glass-panel">
          <table className="ra-voc-table">
            <thead>
              <tr>
                <th>속성</th>
                <th>VoC 수</th>
                <th>긍/부정 비율</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(productGroups).map(([pid, { brandName, productName, rows }]) => (
                <React.Fragment key={pid}>
                  <tr className="ra-voc-group-header">
                    <td colSpan={3}>
                      <span style={{ marginRight: '0.5rem', opacity: 0.7 }}>{brandName}</span>
                      {productName}
                    </td>
                  </tr>
                  {rows.map((row) => {
                    const isSelected = selectedVocRow?.productId === row.productId && selectedVocRow?.attributeName === row.attributeName;
                    return (
                      <tr
                        key={`${pid}-${row.attributeName}`}
                        className={`ra-voc-row${isSelected ? ' active' : ''}`}
                        onClick={() => { setSelectedVocRow(row); setVocDetailFilter(null); loadVocDetail(row, null); }}
                      >
                        <td className="ra-voc-cell-attr">{row.attributeName}</td>
                        <td className="ra-voc-cell-count">{row.totalCount}개</td>
                        <td>
                          <div className="ra-voc-ratio-bar">
                            <div className="ra-voc-ratio-pos" style={{ width: `${row.positiveRate}%` }} />
                            <div className="ra-voc-ratio-neu" style={{ width: `${row.neutralRate || 0}%` }} />
                            <div className="ra-voc-ratio-neg" style={{ width: `${row.negativeRate}%` }} />
                          </div>
                          <div className="ra-voc-ratio-labels">
                            <span className="pos">{row.positiveRate}%</span>
                            <span className="neg">{row.negativeRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div
          ref={vocScrollRef}
          className="ra-voc-detail-panel glass-panel"
          onScroll={(e) => {
            if (vocLoadingMoreRef.current || !vocHasMoreRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            if (scrollTop + clientHeight >= scrollHeight - 100) {
              vocLoadingMoreRef.current = true;
              const nextPage = vocPageRef.current + 1;
              vocPageRef.current = nextPage;
              setVocPage(nextPage);
              loadVocDetailRef.current?.(selectedVocRowRef.current, vocDetailFilterRef.current, nextPage, false);
            }
          }}
        >
          {!selectedVocRow ? (
            <div className="ra-empty-state">왼쪽에서 속성을 선택하세요.</div>
          ) : (
            <>
              <div className="ra-voc-detail-header">
                <h4>{selectedVocRow.productName} — {selectedVocRow.attributeName}</h4>
                <div className="ra-voc-detail-keywords">
                  {[
                    ...(selectedVocRow.positive?.keywords || []).slice(0, 3).map(k => ({ ...k, type: 'positive' })),
                    ...(selectedVocRow.neutral?.keywords || []).slice(0, 2).map(k => ({ ...k, type: 'neutral' })),
                    ...(selectedVocRow.negative?.keywords || []).slice(0, 3).map(k => ({ ...k, type: 'negative' })),
                  ].map((kw, ki) => (
                    <span
                      key={ki}
                      className={`ra-voc-keyword ${kw.type}`}
                      onClick={() => {
                        const sent = kw.type === 'neutral' ? 'neutral' : kw.type;
                        setVocDetailFilter(sent);
                        loadVocDetail(selectedVocRow, sent);
                      }}
                    >
                      {kw.keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ra-filter-bar">
                {[{ label: '전체', val: null }, { label: '긍정', val: 'positive' }, { label: '중립', val: 'neutral' }, { label: '부정', val: 'negative' }].map(({ label, val }) => (
                  <button
                    key={label}
                    className={`ra-filter-chip ${vocDetailFilter === val ? 'active' : ''}`}
                    onClick={() => { setVocDetailFilter(val); loadVocDetail(selectedVocRow, val); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="ra-voc-review-list">
                {vocDetailLoading && <div className="ra-empty-state">불러오는 중...</div>}
                {!vocDetailLoading && !vocDetailReviews.length && <div className="ra-empty-state">리뷰가 없습니다.</div>}
                {!vocDetailLoading && vocDetailReviews.map((r, i) => renderReviewCard(r, i))}
                {vocLoadingMore && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                    <Loader2 size={18} className="ra-spinner" style={{ display: 'inline-block', marginRight: '0.4rem' }} />
                    더 불러오는 중...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── AI 전략리포트 ─────────────────────────────────
  const PRIORITY_LABEL = { high: '긴급', mid: '중요', low: '검토' };
  const PRIORITY_COLOR = { high: '#E8734A', mid: '#F39C12', low: '#94a3b8' };

  const renderMarketing = () => {
    const products_list = marketingData?.products;
    if (!products_list?.length) {
      return <div className="ra-empty-state">AI 전략 리포트가 없습니다. 제품을 선택 후 탭을 클릭하세요.</div>;
    }

    return (
      <div className="ra-marketing-container">
        {/* 전체 리포트 생성일 */}
        {marketingData.updatedAt && (
          <div style={{ textAlign: 'right', marginBottom: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
            리포트 생성: {new Date(marketingData.updatedAt).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {products_list.map((rawP, i) => {
          const p = getMktProduct(rawP, i);
          let pid = p.productId;
          const allDash = dashboardDataRef.current.length ? dashboardDataRef.current : dashboardData;
          let dash = pid ? allDash.find(d => String(d.productId) === String(pid)) : null;
          if (!dash) {
            // productName 기반 폴백 (trim 정규화)
            dash = allDash.find(d => d.productName?.trim() === p.productName?.trim() && d.brandName?.trim() === p.brandName?.trim())
                || allDash.find(d => d.productName?.trim() === p.productName?.trim())
                || allDash[i]; // 인덱스 기반 최후 폴백
            if (dash && !pid) pid = dash.productId;
          }
          const override = pid ? marketingOverrides[pid] : null;
          const displayUpdatedAt = override?.updatedAt || (i === 0 ? marketingData.updatedAt : null);
          const total = dash ? parseInt(dash.totalReviews) || 0 : null;
          const pos = dash ? parseInt(dash.positiveCount) || 0 : null;
          const posRate = total > 0 ? Math.round(pos / total * 100) : null;
          const avgRating = dash?.avgRating || null;

          const isSending = pid && notionSendingPids.has(pid);
          const notionUrl = pid ? notionUrls[pid] : null;

          return (
            <div key={i} className="ra-marketing-report">
              {/* 제품별 툴바 */}
              <div className="ra-mkt-product-toolbar">
                <div>
                  <span className="ra-mkt-brand">{p.brandName}</span>
                  <span className="ra-mkt-pname" style={{ marginLeft: '0.75rem' }}>{p.productName}</span>
                  {displayUpdatedAt && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      생성: {new Date(displayUpdatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <div className="ra-mkt-product-actions">
                  {notionUrl ? (
                    <a href={notionUrl} target="_blank" rel="noopener noreferrer" className="ra-mkt-notion-btn success">
                      <ExternalLink size={13} /> 노션 페이지 확인
                    </a>
                  ) : (
                    <button
                      className="ra-mkt-notion-btn"
                      disabled={isSending}
                      onClick={() => sendToNotion(p)}
                    >
                      {isSending ? <Loader2 size={13} className="ra-spinner" /> : null}
                      {isSending ? '전송 중...' : '마케팅부문 노션으로 보내기'}
                    </button>
                  )}
                  <button
                    className="ra-mkt-regen-btn"
                    onClick={() => { setRegenTargetPid(pid); setRegenPassword(''); setRegenError(''); setShowRegenModal(true); }}
                  >
                    ↺ AI 재생성
                  </button>
                </div>
              </div>

              {p.summary && <p className="ra-mkt-summary" style={{ marginBottom: '2rem' }}>{p.summary}</p>}

              {/* 대시보드 기본 정보 (레이아웃 차용) */}
              {dash && (
                <div className="ra-dashboard-row" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                   <div className="ra-dash-card glass-panel" style={{ flex: '1 1 30%', padding: '1.5rem' }}>
                     <div className="ra-dash-card-header">
                       {dash.thumbnailUrl && <img src={dash.thumbnailUrl} alt="" className="ra-dash-thumb" style={{ width: '60px', height: '60px', borderRadius: '8px' }} />}
                       <div style={{ wordBreak: 'keep-all' }}>
                         <span className="ra-dash-brand" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{dash.brandName}</span>
                         <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', lineHeight: '1.4' }}>{dash.productName}</h4>
                          {(() => {
                            const prod = products.find(pr => String(pr.id) === String(pid));
                            const url = prod?.pageUrl || override?.pageUrl || override?.page_url;
                            return url ? <a href={url} target="_blank" rel="noreferrer" className="ra-external-link" style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'inline-block' }}>상품 상세 보기 ↗</a> : null;
                          })()}
                       </div>
                     </div>
                     <div className="ra-dash-stat" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                       <span className="ra-dash-number" style={{ fontSize: '2rem', fontWeight: 'bold' }}>{total.toLocaleString()}</span>
                       <span className="ra-dash-label" style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>기간 내 리뷰수</span>
                       <span className={`ra-dash-growth ${dash.growthRate >= 0 ? 'positive' : 'negative'}`} style={{ marginLeft: 'auto', marginBottom: '0.4rem', fontSize: '0.8rem' }}>{dash.growthRate >= 0 ? '↑' : '↓'} {Math.abs(dash.growthRate)}%</span>
                     </div>
                   </div>
                   <div className="ra-dash-card glass-panel" style={{ flex: '1 1 30%', padding: '1.5rem' }}>
                     <h4 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>{dash.brandName} {dash.productName}</h4>
                     <div className="ra-sentiment-bars">
                       <div className="ra-sentiment-bar" style={{ marginBottom: '1rem' }}>
                         <span className="ra-sentiment-label positive" style={{ width: '60px', fontSize: '0.8rem' }}>긍정비중</span>
                         <div className="ra-bar-track" style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}><div className="ra-bar-fill positive" style={{ width: `${posRate}%`, background: '#60a5fa', height: '100%' }} /></div>
                         <span className="ra-sentiment-pct positive" style={{ width: '40px', textAlign: 'right', fontSize: '0.85rem', color: '#60a5fa', fontWeight: 'bold' }}>{posRate}%</span>
                       </div>
                       <div className="ra-sentiment-bar">
                         <span className="ra-sentiment-label negative" style={{ width: '60px', fontSize: '0.8rem' }}>부정비중</span>
                         <div className="ra-bar-track" style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}><div className="ra-bar-fill negative" style={{ width: `${100-posRate}%`, background: '#f87171', height: '100%' }} /></div>
                         <span className="ra-sentiment-pct negative" style={{ width: '40px', textAlign: 'right', fontSize: '0.85rem', color: '#f87171', fontWeight: 'bold' }}>{100-posRate}%</span>
                       </div>
                     </div>
                     {avgRating && <div className="ra-avg-rating" style={{ marginTop: '1.5rem', color: '#fbbf24', fontSize: '0.9rem', fontWeight: 'bold' }}>평균 ★ {avgRating}</div>}
                   </div>
                   <div className="ra-dash-card glass-panel" style={{ flex: '1 1 30%', padding: '1.5rem' }}>
                     <h4 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>{dash.brandName} {dash.productName}</h4>
                     <div className="ra-top-attrs" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                       <div className="ra-attr-section">
                         <span className="ra-attr-title" style={{ color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>TOP3 긍정 속성</span>
                         <span className="ra-attr-values" style={{ color: '#fff', fontSize: '0.9rem' }}>{dash.topAttributes?.positive?.length ? dash.topAttributes.positive.slice(0, 3).map(a => a.name).join(', ') : '-'}</span>
                       </div>
                       <div className="ra-attr-section">
                         <span className="ra-attr-title" style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>TOP3 부정 속성</span>
                         <span className="ra-attr-values" style={{ color: '#fff', fontSize: '0.9rem' }}>{dash.topAttributes?.negative?.length ? dash.topAttributes.negative.slice(0, 3).map(a => a.name).join(', ') : '-'}</span>
                       </div>
                     </div>
                   </div>
                </div>
              )}

              <div className="ra-mkt-grid">
                {/* VoC 개선 */}
                <div className="ra-mkt-section ra-mkt-section-full">
                  <h4 className="ra-mkt-section-title"><TrendingDown size={16} /> VoC 기반 개선 액션플랜</h4>
                  <div className="ra-mkt-voc-table-wrap">
                    <table className="ra-marketing-voc-table">
                      <thead><tr><th>우선순위</th><th>핵심 불만 이슈</th><th>개선 제안</th></tr></thead>
                      <tbody>
                        {(p.vocImprovements || []).map((item, j) => (
                          <tr key={j}>
                            <td><span className="ra-mkt-priority" style={{ background: PRIORITY_COLOR[item.priority] }}>{PRIORITY_LABEL[item.priority] || item.priority}</span></td>
                            <td className="ra-voc-issue">{item.issue}</td>
                            <td className="ra-voc-action">{item.suggestion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* USP */}
                <div className="ra-mkt-section">
                  <h4 className="ra-mkt-section-title"><TrendingUp size={16} /> 핵심 소구포인트 (USP)</h4>
                  <div className="ra-mkt-usp-list">
                    {(p.uspPoints || []).map((usp, j) => (
                      <div key={j} className="ra-mkt-usp-item">
                        <span className="ra-mkt-usp-num">{j + 1}</span><span>{usp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 카피라이트 */}
                <div className="ra-mkt-section">
                  <h4 className="ra-mkt-section-title"><Megaphone size={16} /> 추천 광고 카피라이트</h4>
                  <div className="ra-mkt-catchphrase-list">
                    {(p.catchphrases || []).map((cp, j) => (
                      <div key={j} className="ra-mkt-catchphrase-item">
                        <span className="ra-mkt-badge catchphrase">COPY {j + 1}</span>
                        <p>"{cp}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 콘텐츠 아이디어 + 콘티 */}
                <div className="ra-mkt-section ra-mkt-section-full">
                  <h4 className="ra-mkt-section-title"><MessageSquare size={16} /> 콘텐츠 제작 아이디어 (30~60초 콘티)</h4>
                  <div className="ra-mkt-hooks-grid">
                    {(p.contentIdeas || []).map((idea, j) => (
                      <div key={j} className="ra-mkt-hook-card">
                        <span className="ra-mkt-badge" style={{ background: 'rgba(157,206,99,0.2)', color: '#9dce63' }}>{idea.format}</span>
                        <p className="ra-mkt-content-concept">{idea.concept}</p>
                        {idea.hook && <p className="ra-mkt-hook-text">💡 "{idea.hook}"</p>}
                        {idea.storyboard && (
                          <div className="ra-mkt-storyboard">📋 {idea.storyboard}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── 모달: 리뷰 팝업 ───────────────────────────────
  const renderReviewModal = () => {
    if (!showReviewModal) return null;
    return (
      <div className="ra-modal-overlay" onClick={() => setShowReviewModal(false)}>
        <div className="ra-modal-content" onClick={e => e.stopPropagation()}>
          <div className="ra-modal-header" style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
            <h3>{modalTitle}</h3>
            <button onClick={() => setShowReviewModal(false)}><X size={20} /></button>
          </div>
          {modalReviews.length > 0 && (
            <div className="ra-modal-subattrs" style={{ padding: '0 1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[...new Set(modalReviews.flatMap(r => (r.sourceHighlight||[]).map(h => h.text)))].slice(0, 10).map((txt, idx) => (
                <span key={idx} style={{ padding: '0.4rem 0.8rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50px', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd' }}>
                  {txt}
                </span>
              ))}
            </div>
          )}
          <div
            ref={modalScrollRef}
            className="ra-modal-body"
            style={{ overflowY: 'auto' }}
            onScroll={(e) => {
              if (modalLoadingMoreRef.current || !modalHasMoreRef.current) return;
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollTop + clientHeight >= scrollHeight - 100) {
                modalLoadingMoreRef.current = true;
                const nextPage = modalPageRef.current + 1;
                modalPageRef.current = nextPage;
                setModalPage(nextPage);
                const { pids, attr, sent } = modalParamsRef.current;
                loadModalReviewsRef.current?.(pids, attr, sent, nextPage, false);
              }
            }}
          >
            {modalLoading
              ? <div className="ra-loading"><Loader2 className="ra-spinner" /><span>리뷰 로드 중...</span></div>
              : modalReviews.map((r, i) => renderReviewCard(r, i))
            }
            {modalLoadingMore && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                <Loader2 size={18} className="ra-spinner" style={{ display: 'inline-block', marginRight: '0.4rem' }} />
                더 불러오는 중...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 모달: 워드클라우드 ────────────────────────────
  const renderWordCloudModal = () => {
    if (!showWordCloudModal) return null;
    const safeWords = (wordCloudData || [])
      .filter(w => w.value > 0 && w.text)
      .map(w => ({ text: String(w.text), value: Number(w.value) }))
      .slice(0, 50);

    return (
      <div className="ra-modal-overlay" onClick={() => setShowWordCloudModal(false)}>
        <div className="ra-modal-content" onClick={e => e.stopPropagation()}>
          <div className="ra-modal-header">
            <h3>버즈량 분석</h3>
            <button onClick={() => setShowWordCloudModal(false)}><X size={20} /></button>
          </div>
          <div className="ra-modal-body" style={{ padding: '1.5rem' }}>
            {safeWords.length > 0 ? (
              <div style={{ width: '100%', height: 400, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: '15px', overflow: 'hidden' }}>
                {safeWords.sort(() => Math.random() - 0.5).map((w, i) => {
                  const maxVal = Math.max(...safeWords.map(sw => sw.value));
                  const minVal = Math.min(...safeWords.map(sw => sw.value));
                  const size = maxVal === minVal ? 24 : 14 + ((w.value - minVal) / (maxVal - minVal)) * 46;
                  const isRotated = Math.random() > 0.7; // 30% chance to rotate text
                  return (
                    <span
                      key={i}
                      onClick={() => {
                        setShowWordCloudModal(false);
                        setTimeout(() => openReviewModal(w.text, wordCloudPid ? [wordCloudPid] : selectedProducts, w.text, null), 0);
                      }}
                      style={{
                        fontSize: `${size}px`,
                        fontWeight: 'bold',
                        color: CHART_COLORS[i % CHART_COLORS.length],
                        cursor: 'pointer',
                        transform: isRotated ? 'scale(1.1) rotate(-5deg)' : 'none',
                        transition: 'transform 0.1s',
                        display: 'inline-block',
                        lineHeight: 1
                      }}
                      onMouseEnter={e => e.target.style.transform = isRotated ? 'scale(1.2) rotate(-5deg)' : 'scale(1.1)'}
                      onMouseLeave={e => e.target.style.transform = isRotated ? 'scale(1.1) rotate(-5deg)' : 'none'}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </div>
            ) : <div className="ra-empty-state">데이터가 없습니다.</div>}
          </div>
        </div>
      </div>
    );
  };

  // ── 모달: AI 재생성 패스워드 ──────────────────────
  const renderRegenModal = () => {
    if (!showRegenModal) return null;
    return (
      <div className="ra-modal-overlay" onClick={() => setShowRegenModal(false)}>
        <div className="ra-modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div className="ra-modal-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lock size={18} /> AI 리포트 재생성</h3>
            <button onClick={() => setShowRegenModal(false)}><X size={20} /></button>
          </div>
          <div className="ra-modal-body" style={{ padding: '1.5rem' }}>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              재생성하면 기존 리포트를 덮어씁니다. 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={regenPassword}
              onChange={e => setRegenPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegenSubmit()}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '1rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
              autoFocus
            />
            {regenError && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{regenError}</p>}
            <button
              onClick={handleRegenSubmit}
              style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}
            >
              재생성 시작
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="container ra-container">
      <header className="ra-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="ra-page-title">리뷰 &amp; VoC 마켓 인사이트</h1>
            <p style={{ color: 'var(--text-dim)' }}>애경 브랜드의 시장 경쟁력을 AI로 실시간 분석합니다.</p>
          </div>
          <div className="ra-date-range">
            <Calendar size={18} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /> ~
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="ra-product-selector" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }} ref={dropdownRef}>
          <div style={{ position: 'relative' }}>
            <button className="ra-dropdown-trigger glass-panel" onClick={() => setShowProductDropdown(!showProductDropdown)}>
              {selectedProducts.length > 0 ? `${selectedProducts.length}개 제품 선택됨` : '제품 선택'} <ChevronDown size={18} />
            </button>
            {showProductDropdown && (
              <div className="ra-dropdown-menu glass-panel">
                {products.map(p => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(p.id)}
                      onChange={() => setSelectedProducts(prev =>
                        prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                      )}
                    />
                    {' '}{p.productName}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
            {selectedProducts.map(pid => {
              const prod = products.find(p => p.id === pid);
              if (!prod) return null;
              return (
                <div key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.08)', border: '1px solid #9dce63', color: '#9dce63', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {prod.productName}
                  <button onClick={() => removeProduct(pid)} style={{ background: 'none', border: 'none', color: '#9dce63', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                </div>
              );
            })}
          </div>
          <button className="ra-manage-btn" onClick={() => setShowUrlManager(true)}><Settings size={16} /> URL 관리</button>
        </div>

        <div className="ra-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`ra-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="ra-content">
        {loading
          ? <div className="ra-loading"><Loader2 className="ra-spinner" size={40} /><span>데이터를 분석하고 있습니다...</span></div>
          : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'period' && renderPeriod()}
              {activeTab === 'sentiment' && renderSentiment()}
              {activeTab === 'voc' && renderVoc()}
              {activeTab === 'marketing' && renderMarketing()}
            </>
          )
        }
      </div>

      {renderReviewModal()}
      {renderWordCloudModal()}
      {renderRegenModal()}
      <ProductUrlManager isOpen={showUrlManager} onClose={() => setShowUrlManager(false)} products={products} onRefresh={fetchProducts} />
    </main>
  );
}

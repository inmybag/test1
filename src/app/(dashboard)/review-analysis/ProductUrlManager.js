'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Globe, ExternalLink } from 'lucide-react';

function detectPlatform(url) {
  if (url.includes('oliveyoung.co.kr')) return { name: '올리브영', color: '#9dce63' };
  if (url.includes('smartstore.naver.com') || url.includes('brand.naver.com') || url.includes('shopping.naver.com')) return { name: '네이버', color: '#03c75a' };
  if (url.includes('musinsa.com')) return { name: '무신사', color: '#000000' };
  return { name: '카페24', color: '#2c6ecb' };
}

export default function ProductUrlManager({ isOpen, onClose, products, onRefresh }) {
  const [pageUrl, setPageUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [productName, setProductName] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  if (!isOpen) return null;

  const detectedPlatform = pageUrl ? detectPlatform(pageUrl) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pageUrl || !brandName || !productName || !secretKey) return;

    setLoading(true);
    try {
      const res = await fetch('/api/reviews/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, brandName, productName, secretKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setPageUrl('');
        setBrandName('');
        setProductName('');
        setSecretKey('');
        onRefresh();
        alert('성공적으로 등록 후 데이터 수집을 요청했습니다!');
      } else {
        alert(data.error || '등록 실패');
      }
    } catch (err) {
      alert('등록 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/reviews/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        onRefresh();
      }
    } catch (err) {
      alert('삭제 중 오류 발생');
    }
  };

  return (
    <div className="ra-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ra-modal-content glass-panel">
        <div className="ra-modal-header">
          <h2>제품 URL 관리</h2>
          <button className="ra-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 등록 폼 */}
        <form className="ra-url-form" onSubmit={handleSubmit}>
          <div className="ra-form-row">
            <div className="ra-input-group ra-url-input-group">
              <label>페이지 URL</label>
              <div className="ra-url-input-wrapper">
                <input
                  type="url"
                  placeholder="https://www.oliveyoung.co.kr/store/goods/..."
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  required
                />
                {detectedPlatform && (
                  <span className="ra-platform-badge" style={{ background: detectedPlatform.color }}>
                    {detectedPlatform.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="ra-form-row ra-form-row-half">
            <div className="ra-input-group">
              <label>브랜드명</label>
              <input
                type="text"
                placeholder="예: 에이지투웨니스"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
              />
            </div>
            <div className="ra-input-group">
              <label>상품명</label>
              <input
                type="text"
                placeholder="예: 포어 스케일링 엔자임 클렌징 파우더 60g"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="ra-form-row">
            <div className="ra-input-group">
              <label>관리자 인증키</label>
              <input
                type="password"
                placeholder="등록 암호를 입력하세요"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="ra-add-btn" disabled={loading}>
            <Plus size={16} />
            {loading ? '등록 중...' : '제품 등록'}
          </button>
        </form>

        {/* 등록된 제품 목록 */}
        <div className="ra-product-list">
          <h3>등록된 제품 ({products.length})</h3>
          {products.length === 0 ? (
            <p className="ra-empty">등록된 제품이 없습니다.</p>
          ) : (
            <div className="ra-product-items">
              {products.map((product) => {
                const platform = detectPlatform(product.pageUrl || product.page_url || '');
                return (
                  <div key={product.id} className="ra-product-item">
                    <div className="ra-product-item-info">
                      <span className="ra-platform-tag" style={{ background: platform.color }}>
                        {platform.name}
                      </span>
                      <div className="ra-product-item-detail">
                        <span className="ra-brand">{product.brandName || product.brand_name}</span>
                        <span className="ra-name">{product.productName || product.product_name}</span>
                      </div>
                      <a href={product.pageUrl || product.page_url} target="_blank" rel="noreferrer" className="ra-link-btn">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                    {deleteConfirm === product.id ? (
                      <div className="ra-delete-confirm">
                        <span>리뷰 데이터도 함께 삭제됩니다</span>
                        <button className="ra-delete-yes" onClick={() => handleDelete(product.id)}>삭제</button>
                        <button className="ra-delete-no" onClick={() => setDeleteConfirm(null)}>취소</button>
                      </div>
                    ) : (
                      <button className="ra-delete-btn" onClick={() => setDeleteConfirm(product.id)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

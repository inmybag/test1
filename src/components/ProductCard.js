import { LineChart } from 'lucide-react';

export default function ProductCard({ product, onViewChart }) {
  const formatPrice = (price) => {
    if (!price) return '0';
    return price;
  };

  return (
    <div className="product-card">
      <div className="rank-badge">{product.rank}</div>
      <div className="image-container">
        <img 
          src={product.imageUrl} 
          alt={product.title} 
          className="product-image"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400x400?text=No+Image'; }}
        />
      </div>
      <div className="product-info">
        <div className="brand-name">{product.brand}</div>
        <h3 className="product-title">{product.title}</h3>
        <div className="price-container">
          <span className="price-number">{formatPrice(product.price)}</span>
          <span className="price-currency">원</span>
        </div>
        <button 
          className="view-chart-btn" 
          onClick={() => onViewChart(product.title)}
        >
          <LineChart size={18} /> 차트 보기
        </button>
      </div>
    </div>
  );
}

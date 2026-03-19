import ProductCard from './ProductCard';

export default function ProductList({ products, onViewChart }) {
  if (!products || products.length === 0) {
    return (
      <div className="no-data-state">
        <p>해당 날짜의 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard 
          key={`${product.rank}-${index}`} 
          product={product} 
          onViewChart={onViewChart}
        />
      ))}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // 200px만 내려도 나타나도록 기준 완화
      if (window.scrollY > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button className="btn-top-global" onClick={scrollToTop} aria-label="Scroll to top">
      <TrendingUp size={20} style={{ transform: 'rotate(-90deg)' }} />
      <span>TOP</span>

      <style jsx>{`
        .btn-top-global {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 50%;
          background: #3b82f6; /* 모바일 가시성을 위해 확실한 색상 적용 */
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.1rem;
          cursor: pointer;
          z-index: 99999; /* 최상단 배치 */
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        .btn-top-global:hover {
          transform: translateY(-5px);
          background: #2563eb;
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6);
        }

        .btn-top-global span {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        @media (max-width: 768px) {
          .btn-top-global {
            bottom: 1.5rem;
            right: 1.5rem;
            width: 3.2rem;
            height: 3.2rem;
            /* 모바일에서는 더 잘 보이도록 밝은 톤 유지 */
            opacity: 0.9;
          }
        }
      `}</style>
    </button>
  );
}

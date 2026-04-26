'use client';

import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
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
    <button className="btn-top-global" onClick={scrollToTop}>
      <TrendingUp size={24} style={{ transform: 'rotate(-90deg)' }} />
      <span>TOP</span>

      <style jsx>{`
        .btn-top-global {
          position: fixed;
          bottom: 3rem;
          right: 3rem;
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          background: rgba(13, 13, 16, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          cursor: pointer;
          z-index: 2000;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .btn-top-global:hover {
          transform: translateY(-5px);
          background: #fff;
          color: #000;
          border-color: #fff;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }

        .btn-top-global span {
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        @media (max-width: 768px) {
          .btn-top-global {
            bottom: 2rem;
            right: 2rem;
            width: 3.5rem;
            height: 3.5rem;
          }
        }
      `}</style>
    </button>
  );
}

'use client';

import { Sparkles, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-line"></div>
        <div className="footer-info">
          <div className="footer-brand">
            <div className="brand-dot"></div>
            <span>AI MARKETING INTELLIGENCE</span>
          </div>
          <div className="footer-message">
            <Sparkles size={14} className="text-blue-400" />
            <span className="accent-text">애경 마케팅부문 화이팅</span>
            <Heart size={12} className="text-pink-500 fill-pink-500" />
          </div>
          <div className="footer-copyright">
            © 2026 AEKYUNG Industrial. All Rights Reserved.
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer {
          width: 100%;
          padding: 2rem 2rem 3rem; /* 여백 대폭 축소 */
          background: transparent;
          position: relative;
          z-index: 10;
        }

        .footer-content {
          max-width: 1400px;
          margin: 0 auto;
        }

        .footer-line {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.2), transparent);
          margin-bottom: 2rem;
        }

        .footer-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.7rem;
          font-weight: 800;
          color: #475569;
          letter-spacing: 0.2em;
        }

        .brand-dot {
          width: 5px;
          height: 5px;
          background: #3b82f6;
          border-radius: 50%;
        }

        .footer-message {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: rgba(255, 255, 255, 0.02);
          padding: 0.6rem 1.5rem;
          border-radius: 99rem;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .accent-text {
          font-size: 0.95rem;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: -0.01em;
        }

        .footer-copyright {
          font-size: 0.7rem;
          color: #334155;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .footer { padding-top: 1rem; }
          .accent-text { font-size: 0.85rem; }
        }
      `}</style>
    </footer>
  );
}

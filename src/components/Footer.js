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
            <Sparkles size={16} className="text-blue-400" />
            <span className="accent-text">애경 마케팅부문 화이팅</span>
            <Heart size={14} className="text-pink-500 fill-pink-500" />
          </div>
          <div className="footer-copyright">
            © 2026 AEKYUNG Industrial. All Rights Reserved.
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer {
          width: 100%;
          padding: 6rem 2rem 4rem;
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
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.3), transparent);
          margin-bottom: 3rem;
        }

        .footer-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          font-weight: 800;
          color: #475569;
          letter-spacing: 0.2em;
        }

        .brand-dot {
          width: 6px;
          height: 6px;
          background: #3b82f6;
          border-radius: 50%;
          box-shadow: 0 0 10px #3b82f6;
        }

        .footer-message {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          background: rgba(255, 255, 255, 0.03);
          padding: 0.8rem 2rem;
          border-radius: 99rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
        }

        .accent-text {
          font-size: 1.1rem;
          font-weight: 900;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.01em;
        }

        .footer-copyright {
          font-size: 0.75rem;
          color: #334155;
          font-weight: 500;
          letter-spacing: 0.05em;
        }

        @media (max-width: 768px) {
          .footer { padding-top: 4rem; }
          .accent-text { font-size: 1rem; }
        }
      `}</style>
    </footer>
  );
}

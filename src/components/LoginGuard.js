'use client';

import { useState, useEffect } from 'react';

export default function LoginGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(c => c.trim().startsWith('admin_auth='));
    
    if (authCookie && authCookie.split('=')[1] === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'qwer') {
      // Set cookie for 7 days
      const date = new Date();
      date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));
      document.cookie = `admin_auth=true; expires=${date.toUTCString()}; path=/`;
      
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
      // Shake animation
      const container = document.getElementById('login-box');
      if (container) {
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
      }
    }
  };

  if (!isMounted) return null; // Avoid hydration mismatch

  if (!isAuthenticated) {
    return (
      <div className="login-overlay">
        <div id="login-box" className="login-box glass-panel">
          <div className="login-header">
            <h2>AI 활용시스템 접속</h2>
            <p className="subtitle-en">Access Required</p>
            <p className="security-notice">"패스워드 유출이 안되도록 보안 신경써주세요 - 고영제"</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="패스워드를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={error ? 'error' : ''}
              autoFocus
            />
            {error && <p className="error-text">틀린 패스워드입니다. (qwer)</p>}
            <button type="submit">접속하기</button>
          </form>
        </div>

        <style jsx>{`
          .login-overlay {
            position: fixed;
            inset: 0;
            background: #050507;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          
          .login-box {
            width: 100%;
            max-width: 400px;
            padding: 3rem;
            text-align: center;
            background: rgba(255, 255, 255, 0.03) !important;
            border-radius: 2rem !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            backdrop-filter: blur(40px) !important;
            animation: fadeIn 0.8s ease-out;
          }

          .login-header h2 {
            font-size: 1.8rem;
            font-weight: 900;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #fff 40%, #64748b 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .login-header p {
            font-size: 0.8rem;
            color: #475569;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            margin-bottom: 2.5rem;
          }

          form {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          input {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 1.2rem;
            border-radius: 1rem;
            color: #fff;
            text-align: center;
            font-size: 1.1rem;
            outline: none;
            transition: all 0.3s;
          }

          input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
          }

          input.error {
            border-color: #ef4444;
          }

          .error-text {
            font-size: 0.8rem;
            color: #ef4444;
            margin-top: -1rem;
          }

          button {
            background: #fff;
            color: #000;
            border: none;
            padding: 1.2rem;
            border-radius: 1rem;
            font-weight: 800;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          button:hover {
            transform: scale(1.02);
            filter: brightness(0.9);
            box-shadow: 0 10px 30px -5px rgba(255, 255, 255, 0.2);
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          :global(.shake) {
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
          }

          @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
          }
        `}</style>
      </div>
    );
  }

  return children;
}

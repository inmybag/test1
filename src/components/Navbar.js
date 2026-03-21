'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { title: '올리브영 랭킹', href: '/' },
    // 추후 메뉴 추가 시 여기에 객체 추가
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/" className="nav-logo">
          <span className="logo-dot"></span>
          OY Rank
        </Link>
        
        <div className="nav-desktop">
          {menuItems.map((item, idx) => (
            <Link key={idx} href={item.href} className="nav-link">
              {item.title}
            </Link>
          ))}
        </div>

        <button 
          className="hamburger" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`nav-mobile ${isOpen ? 'active' : ''}`}>
        <div className="nav-mobile-content glass-panel">
          {menuItems.map((item, idx) => (
            <Link 
              key={idx} 
              href={item.href} 
              className="nav-mobile-link"
              onClick={() => setIsOpen(false)}
            >
              {item.title}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

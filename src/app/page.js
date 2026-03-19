'use client';

import { useState, useEffect } from 'react';
import ProductList from '@/components/ProductList';
import ChartModal from '@/components/ChartModal';
import { Calendar } from 'lucide-react';

export default function Home() {
  const [date, setDate] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Set today's date initially
    const today = new Date();
    const timezoneOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = new Date(today - timezoneOffset).toISOString().split('T')[0];
    setDate(localISOTime);
    fetchRankings(localISOTime.replace(/-/g, ''));
  }, []);

  const fetchRankings = async (dateStr) => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/rankings?date=${dateStr}`);
      const result = await response.json();
      if (result.data) {
        setRankings(result.data);
      } else {
        setRankings([]);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    if (newDate) {
      fetchRankings(newDate.replace(/-/g, ''));
    }
  };

  const handleViewChart = async (title) => {
    setSelectedTitle(title);
    setModalOpen(true);
    try {
      const dateStr = date.replace(/-/g, '');
      const response = await fetch(`/api/history?title=${encodeURIComponent(title)}&date=${dateStr}`);
      const result = await response.json();
      setHistory(result.history || []);
    } catch (err) {
      console.error(err);
      setHistory([]);
    }
  };

  return (
    <main className="container">
      <header>
        <div className="title-section">
          <h1>Olive Young Rankings</h1>
          <p style={{ color: 'var(--text-dim)' }}>일간 판매 랭킹 및 가격 변동 추이</p>
        </div>
        
        <div className="controls glass-panel">
          <Calendar size={20} color="var(--primary)" />
          <input 
            type="date" 
            value={date} 
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
          <p>데이터를 불러오는 중입니다...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#ff4b4b' }}>
          <p>데이터 로딩 중 오류가 발생했습니다.</p>
        </div>
      ) : (
        <ProductList products={rankings} onViewChart={handleViewChart} />
      )}

      <ChartModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={selectedTitle} 
        history={history}
      />
    </main>
  );
}

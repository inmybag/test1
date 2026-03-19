'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { X } from 'lucide-react';

Chart.register(...registerables);

export default function ChartModal({ title, isOpen, onClose, history }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (isOpen && history && history.length > 0 && chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      const labels = history.map(item => {
        const m = item.dateStr.substring(4, 6);
        const d = item.dateStr.substring(6, 8);
        return `${m}.${d}`;
      });

      const rankData = history.map(item => item.rank);
      const priceData = history.map(item => {
        if (item.price) {
          return parseInt(item.price.toString().replace(/,/g, ''), 10) || 0;
        }
        return 0;
      });

      const gradientRank = ctx.createLinearGradient(0, 0, 0, 400);
      gradientRank.addColorStop(0, 'rgba(157, 206, 99, 0.5)');
      gradientRank.addColorStop(1, 'rgba(15, 23, 42, 0)');

      const gradientPrice = ctx.createLinearGradient(0, 0, 0, 400);
      gradientPrice.addColorStop(0, 'rgba(99, 157, 206, 0.5)');
      gradientPrice.addColorStop(1, 'rgba(15, 23, 42, 0)');

      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: '순위',
              data: rankData,
              yAxisID: 'y',
              borderColor: '#9dce63',
              backgroundColor: gradientRank,
              borderWidth: 3,
              fill: true,
              tension: 0.3,
              pointRadius: 4,
            },
            {
              label: '가격',
              data: priceData,
              yAxisID: 'y1',
              borderColor: '#639dce',
              backgroundColor: gradientPrice,
              borderWidth: 3,
              fill: true,
              tension: 0.3,
              pointRadius: 4,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } },
            tooltip: {
              mode: 'index',
              intersect: false,
            }
          },
          scales: {
            y: {
              position: 'left',
              reverse: true,
              min: 1,
              suggestedMax: 100,
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              title: { display: true, text: '순위', color: '#94a3b8' }
            },
            y1: {
              position: 'right',
              ticks: { 
                color: '#94a3b8',
                callback: (val) => val.toLocaleString()
              },
              grid: { drawOnChartArea: false },
              title: { display: true, text: '가격(원)', color: '#639dce' }
            },
            x: {
              ticks: { color: '#94a3b8' },
              grid: { display: false }
            }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [isOpen, history]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="close-btn" onClick={onClose}><X size={32} /></div>
        <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>{title}</h2>
        <div className="chart-container">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}

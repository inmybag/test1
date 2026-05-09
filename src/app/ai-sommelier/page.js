'use client';

import React, { useState, useEffect } from 'react';
import './sommelier.css';

const EXAMPLE_POOL = [
  "비 오는 날 어울리는 차분한 우디향",
  "포근한 비누향이 나는 깨끗한 느낌",
  "상큼한 시트러스로 기분 전환하고 싶어요",
  "미모사처럼 화사하고 포근한 꽃내음",
  "퇴근 후 혼자만의 시간에 어울리는 향",
  "중요한 미팅 전, 신뢰감을 주는 향",
  "첫 데이트에서 설레는 분위기를 연출하고 싶을 때",
  "이른 아침 숲속을 걷는 듯한 싱그러움",
  "포근한 이불 속에서 느껴지는 머스크향",
  "달콤한 무화과와 코코넛의 이국적인 조화",
  "새벽 안개가 낀 장미 정원의 우아함",
  "따뜻한 차 한 잔과 어울리는 고요한 향",
  "여름 바다의 시원함이 느껴지는 소금기와 앰버",
  "오렌지 나무 아래서 느끼는 상큼하고 달콤한 휴식"
];

export default function AISommelier() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [examples, setExamples] = useState([]);

  useEffect(() => {
    const shuffled = [...EXAMPLE_POOL].sort(() => 0.5 - Math.random());
    setExamples(shuffled.slice(0, 4));
  }, []);

  const handleRecommend = async (customPrompt) => {
    const targetPrompt = customPrompt || prompt;
    if (!targetPrompt.trim()) return;

    if (customPrompt) setPrompt(customPrompt);
    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/ai-sommelier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: targetPrompt }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // 텍스트 포맷팅 (볼드 처리 등)
      const formattedText = data.text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>');

      setResult(formattedText);
    } catch (error) {
      console.error('Error:', error);
      setResult('죄송합니다. 서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tsl-sommelier-container">
      <div className="tsl-ai-header">
        <h3>티슬로 향 소믈리에</h3>
        <p>당신이 찾고 있는 향기의 분위기나 추억, 혹은 계절을 편하게 들려주세요. TISLO의 13가지 향 중 가장 완벽한 매치를 제안해 드립니다.</p>
      </div>

      <div className="tsl-ai-body">
        <div className="tsl-example-container">
          <p className="tsl-example-title">추천 예시 문장</p>
          <div className="tsl-example-list">
            {examples.map((ex, idx) => (
              <button 
                key={idx} 
                className="tsl-example-btn"
                onClick={() => handleRecommend(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="찾으시는 향의 분위기나 느낌을 자유롭게 적어주세요."
        />
        <button 
          className="tsl-btn-recommend" 
          onClick={() => handleRecommend()}
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            'AI가 당신을 위한 향기를 고르고 있습니다...'
          ) : (
            <><span>✨</span> 티슬로 향 추천받기</>
          )}
        </button>

        {loading && (
          <div className="tsl-ai-loading">
            <div className="tsl-spinner"></div>
            <p>소믈리에가 최상의 향을 분석 중입니다...</p>
          </div>
        )}

        {result && (
          <div 
            className="tsl-ai-result"
            dangerouslySetInnerHTML={{ __html: result }}
          />
        )}
      </div>
    </div>
  );
}

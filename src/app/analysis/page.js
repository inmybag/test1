'use client';

import { useState } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight } from 'lucide-react';

export default function AnalysisPage() {
  const [url, setUrl] = useState('');

  return (
    <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            AI 영상 분석 파이프라인
          </h1>
          <p className="text-gray-400 text-lg">
            유튜브 쇼츠, 틱톡, 릴스 영상을 분석하여 인사이트를 도출합니다.
          </p>
        </div>

        <div className="glass-panel p-8 mb-12 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-md">
          <label htmlFor="video-url" className="block text-sm font-medium text-gray-300 mb-2">
            영상 URL 입력
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              id="video-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/shorts/..."
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20">
              분석 시작 <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="glass-panel p-6 border border-white/10 rounded-xl bg-white/5">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 mb-4">
              <Video size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">데이터 수집</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              브라우저 에이전트가 영상의 제목, 조회수, 좋아요 등 메타데이터를 실시간으로 크롤링합니다.
            </p>
          </div>
          <div className="glass-panel p-6 border border-white/10 rounded-xl bg-white/5">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 mb-4">
              <Play size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">미디어 프로세싱</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              영상에서 오디오를 추출하고 텍스트로 변환(STT)하여 분석 가능한 데이터로 가공합니다.
            </p>
          </div>
          <div className="glass-panel p-6 border border-white/10 rounded-xl bg-white/5">
            <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center text-pink-400 mb-4">
              <BarChart2 size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">콘텐츠 분석</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              LLM 기반 에이전트가 훅(Hook) 요소와 감정선을 분석하여 성과 원인을 파악합니다.
            </p>
          </div>
          <div className="glass-panel p-6 border border-white/10 rounded-xl bg-white/5">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400 mb-4">
              <Info size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">인사이트 리포트</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              수집된 모든 데이터를 종합하여 실행 가능한 인사이트가 담긴 리포트를 생성합니다.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glass-panel {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-panel:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </main>
  );
}

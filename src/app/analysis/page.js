'use client';

import { useState, useEffect } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight } from 'lucide-react';

export default function AnalysisPage() {
const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    fetchResults();
  }, [category]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
      const catParam = category === 'All' ? '' : `&category=${category}`;
      const response = await fetch(`/api/analysis/results?date=${today}${catParam}`);
      const data = await response.json();
      setVideos(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-[#0a0a0c]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            Daily AI Shorts Insights
          </h1>
          <p className="text-gray-400 text-lg">
            뷰티 및 생활용품 카테고리의 오늘의 인기 쇼츠 분석 리포트입니다.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex justify-center gap-4 mb-12">
          {['All', 'Beauty', 'Household'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                category === cat 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {cat === 'All' ? '전체' : cat === 'Beauty' ? '뷰티' : '생활용품'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">데이터를 분석 중입니다...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {videos.map((video) => (
              <div 
                key={video.videoId} 
                className="video-card glass-panel group cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative aspect-video rounded-t-xl overflow-hidden">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs text-white">
                    {video.category}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play fill="white" size={48} />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-white line-clamp-2 leading-tight flex-1 mr-2">
                      {video.title}
                    </h3>
                    <div className="w-10 h-10 rounded-full border-2 border-blue-500/50 flex items-center justify-center text-blue-400 font-bold text-xs">
                      {video.analysisJson.score}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                    {video.analysisJson.summary}
                  </p>
                  <div className="flex items-center text-blue-400 text-sm font-medium gap-1">
                    인사이트 상세보기 <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedVideo(null)}>
            <div className="bg-[#121216] max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="relative aspect-video">
                <iframe 
                  src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
                  className="w-full h-full"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">{selectedVideo.title}</h2>
                  <div className="bg-blue-600 px-4 py-1 rounded-full text-white font-bold">
                    Score {selectedVideo.analysisJson.score}
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                      <Play size={18} /> 핵심 후킹 요소
                    </h4>
                    <p className="text-gray-300 bg-white/5 p-3 rounded-lg">
                      {selectedVideo.analysisJson.hook}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
                      <BarChart2 size={18} /> AI 요약 및 분석
                    </h4>
                    <p className="text-gray-300 bg-white/5 p-3 rounded-lg leading-relaxed">
                      {selectedVideo.analysisJson.summary}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                      <Info size={18} /> 성공 포인트 (Takeaways)
                    </h4>
                    <ul className="grid grid-cols-2 gap-3">
                      {selectedVideo.analysisJson.takeaways.map((item, idx) => (
                        <li key={idx} className="text-gray-400 text-sm bg-white/5 px-3 py-2 rounded-lg border border-white/5 flex items-center gap-2">
                           <div className="w-1 h-1 bg-green-400 rounded-full"></div> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="mt-8 w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-all border border-white/10"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .video-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow: hidden;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 1.5rem;
        }
        .video-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-8px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .glass-panel {
          backdrop-blur: 12px;
          -webkit-backdrop-blur: 12px;
        }
      `}</style>
    </main>
  );
}

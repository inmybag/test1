'use client';

import { useState, useEffect } from 'react';
import { Video, Play, BarChart2, Info, ArrowRight, Youtube, Instagram, Music, ExternalLink } from 'lucide-react';

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

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return <Youtube size={16} className="text-red-500" />;
      case 'tiktok': return <Music size={16} className="text-cyan-400" />;
      case 'instagram': return <Instagram size={16} className="text-pink-500" />;
      default: return <Video size={16} />;
    }
  };

  return (
    <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-[#0a0a0c]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Daily AI Discovery
            </h1>
            <p className="text-gray-400 text-lg">
              오늘의 뷰티 & 생활용품 트렌드 분석 리포트
            </p>
          </div>

          <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl">
            {['All', 'Beauty', 'Household'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-8 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                  category === cat 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                {cat === 'All' ? '전체' : cat === 'Beauty' ? '뷰티' : '생활용품'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-gray-500 font-medium">인사이트를 추출하고 있습니다...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {videos.map((video) => (
              <div 
                key={video.videoId} 
                className="video-card glass-panel group cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden mb-4 bg-black/40">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                      {video.category}
                    </div>
                    <div className="bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                      {getPlatformIcon(video.platform)}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/40 to-transparent">
                    <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight mb-2 drop-shadow-lg">
                      {video.title}
                    </h3>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded">
                         Score {video.analysisJson.score}
                       </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-md" onClick={() => setSelectedVideo(null)}>
            <div className="bg-[#0f0f13] max-w-6xl w-full h-full max-h-[90vh] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
              
              <div className="w-full md:w-[60%] bg-black relative flex items-center justify-center">
                <iframe 
                  src={selectedVideo.platform === 'youtube' 
                    ? `https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1` 
                    : selectedVideo.url}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                ></iframe>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="absolute top-6 left-6 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all md:hidden"
                >
                  <ArrowRight className="rotate-180" size={20} />
                </button>
              </div>

              <div className="w-full md:w-[40%] flex flex-col h-full border-l border-white/10">
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                  <div className="flex justify-between items-center mb-8">
                     <div className="flex items-center gap-3">
                        {getPlatformIcon(selectedVideo.platform)}
                        <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">{selectedVideo.platform}</span>
                     </div>
                     <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/40">
                        {selectedVideo.analysisJson.score}
                     </div>
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-8 leading-tight">
                    {selectedVideo.title}
                  </h2>
                  
                  <div className="space-y-8">
                    <section>
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-black mb-3">HOOK STRATEGY</h4>
                      <div className="bg-white/5 border border-white/5 p-5 rounded-2xl text-gray-200 leading-relaxed italic">
                        "{selectedVideo.analysisJson.hook}"
                      </div>
                    </section>
                    
                    <section>
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-purple-400 font-black mb-3">CONTENT ANALYSIS</h4>
                      <p className="text-gray-400 text-[15px] leading-relaxed">
                        {selectedVideo.analysisJson.summary}
                      </p>
                    </section>
                    
                    <section>
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-green-400 font-black mb-3">SUCCESS TAKEAWAYS</h4>
                      <div className="space-y-3">
                        {selectedVideo.analysisJson.takeaways.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-sm text-gray-300 bg-white/5 p-4 rounded-xl border border-white/5">
                             <div className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                             <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="p-8 bg-black/20 border-t border-white/5">
                  <a 
                    href={selectedVideo.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all mb-4"
                  >
                    원본 영상 보기 <ExternalLink size={18} />
                  </a>
                  <button 
                    onClick={() => setSelectedVideo(null)}
                    className="w-full py-4 bg-white/5 text-gray-400 font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .video-card {
           transform: translateZ(0);
           transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .video-card:hover {
          transform: translateY(-12px);
        }
        .glass-panel {
          backdrop-blur: 16px;
          -webkit-backdrop-blur: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </main>
  );
}

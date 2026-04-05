import '../styles/globals.css';
import Navbar from '@/components/Navbar';
import LoginGuard from '@/components/LoginGuard';

export const metadata = {
  title: '마케팅부문 AI 활용시스템',
  description: '매일 업데이트되는 올리브영 실시간 랭킹 및 숏폼 성과 분석 데이터',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="background-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>
        <LoginGuard>
          <Navbar />
          {children}
        </LoginGuard>
      </body>
    </html>
  );
}

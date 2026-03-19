import '../styles/globals.css';

export const metadata = {
  title: '올리브영 랭킹 대시보드 (Next.js)',
  description: '매일 업데이트되는 올리브영 실시간 랭킹 데이터',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="background-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>
        {children}
      </body>
    </html>
  );
}

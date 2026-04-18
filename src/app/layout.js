import '../styles/globals.css';

export const metadata = {
  title: 'TISLO AI 소믈리에',
  description: '티슬로가 제안하는 당신만을 위한 특별한 향기',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}

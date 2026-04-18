import '../styles/globals.css';

export const metadata = {
  title: '애경 마케팅부문 AI',
  description: '애경 마케팅부문 AI 자동화 플랫폼',
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

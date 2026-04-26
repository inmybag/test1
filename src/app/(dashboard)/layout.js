import '../../styles/globals.css';
import Navbar from '@/components/Navbar';
import LoginGuard from '@/components/LoginGuard';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';

export default function DashboardLayout({ children }) {
  return (
    <>
      <div className="background-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      <LoginGuard>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <ScrollToTop />
      </LoginGuard>
    </>
  );
}

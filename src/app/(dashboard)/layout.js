import '../../styles/globals.css';
import Navbar from '@/components/Navbar';
import LoginGuard from '@/components/LoginGuard';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';

export default function DashboardLayout({ children }) {
  return (
    <LoginGuard>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <ScrollToTop />
    </LoginGuard>
  );
}

import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col px-5 pb-4 pt-5">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

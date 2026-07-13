'use client';

import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Header, navLinks } from '@/components/layout/header';
import { MobileMenuOverlay } from '@/components/layout/mobile-menu';
import { Footer } from '@/components/layout/footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';

export function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin') ?? false;
  const isStudioPage = pathname?.startsWith('/studio') ?? false;
  const isAppShellPage = isAdminPage || isStudioPage;
  const isHomePage = pathname === '/';

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('/#home');
  const isClicking = useRef(false);

  // Body scroll lock when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  // Active section tracker
  useEffect(() => {
    const handleScroll = () => {
      if (isClicking.current) return;
      const scrollPosition = window.scrollY + 130;
      for (const link of navLinks) {
        const id = link.href.substring(2);
        if (!id) continue;
        const el = document.getElementById(id);
        if (el && scrollPosition >= el.offsetTop && scrollPosition < el.offsetTop + el.offsetHeight) {
          setActiveLink(link.href);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setIsMenuOpen(false);
    setActiveLink(href);

    if (pathname === '/' && href.startsWith('/#')) {
      e.preventDefault();
      isClicking.current = true;
      const id = href.substring(2);
      const el = document.getElementById(id);
      if (el) {
        const offset = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: offset, behavior: 'smooth' });
        if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      }
      setTimeout(() => { isClicking.current = false; }, 1000);
    }
  }, [pathname]);

  return (
    <>
      {!isAppShellPage && (
        <Header
          isMenuOpen={isMenuOpen}
          onMenuToggle={() => setIsMenuOpen(v => !v)}
          onLinkClick={handleLinkClick}
          activeLink={activeLink}
        />
      )}

      {/* Mobile full-screen menu — direct sibling, no portal, no containment issues */}
      {!isAppShellPage && (
        <MobileMenuOverlay
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          activeLink={activeLink}
          onLinkClick={handleLinkClick}
        />
      )}

      <main className={cn("flex-grow", !isHomePage && !isAppShellPage && "pt-14")}>
        {children}
      </main>

      {!isAppShellPage && <Footer />}
      <Toaster />
    </>
  );
}

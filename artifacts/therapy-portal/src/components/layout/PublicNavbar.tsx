import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { useGetSettings } from '@workspace/api-client-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: settings } = useGetSettings();
  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="container mx-auto px-4 h-[76px] flex items-center justify-between">
        <Link href="/" data-testid="link-home" className="flex items-center gap-3">
          <img src={settings?.logoUrl || logoUrl} alt={settings?.siteName ?? "Ayden's Therapy Services"} className="h-14 w-14 rounded-full object-cover object-top" />
          <span className="hidden sm:block text-[11px] leading-tight tracking-[.17em] uppercase text-primary font-semibold">{settings?.siteName ?? "Ayden's Therapy Services"}</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <button data-testid="button-nav-about" onClick={() => handleScrollTo('about')} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            About
          </button>
          <button data-testid="button-nav-book" onClick={() => handleScrollTo('book')} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Book a Session
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/staff/login" data-testid="link-staff-portal" className="hidden md:inline-flex text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Staff Portal
          </Link>
          <Link href="/portal/login" data-testid="link-client-portal" className="hidden md:inline-flex text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Client Portal
          </Link>
           <ThemeToggle compact />
          <Button data-testid="button-get-started" onClick={() => handleScrollTo('book')} className="rounded-full px-6 shadow-sm">
            Get Started
          </Button>
          <Button data-testid="button-mobile-menu" variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {menuOpen && <div className="md:hidden border-t border-border/60 bg-background px-4 py-4 space-y-1 ats-rise">
        <button data-testid="button-mobile-about" onClick={() => { handleScrollTo('about'); setMenuOpen(false); }} className="block w-full text-left rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">About the practice</button>
        <button data-testid="button-mobile-book" onClick={() => { handleScrollTo('book'); setMenuOpen(false); }} className="block w-full text-left rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">Book a session</button>
        <Link href="/staff/login" data-testid="link-mobile-staff" onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">Staff portal</Link>
        <Link href="/portal/login" data-testid="link-mobile-client" onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">Client portal</Link>
      </div>}
    </header>
  );
}

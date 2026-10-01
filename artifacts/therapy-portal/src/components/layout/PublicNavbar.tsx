import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { useGetSettings } from '@workspace/api-client-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getHomepageContent } from '@/lib/homepageContent';

export function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: settings } = useGetSettings();
  const content = getHomepageContent(settings);
  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md">
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto flex min-h-8 items-center justify-center px-4 text-center font-mono text-[9px] font-bold uppercase tracking-[.14em] sm:justify-between">
          <span>{content.navPrivateSupport}</span>
          <span className="hidden opacity-70 sm:inline">{content.navRegion}</span>
        </div>
      </div>
      <div className="container mx-auto flex h-[82px] items-center justify-between border-b border-border px-4">
        <Link href="/" data-testid="link-home" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center bg-secondary p-1">
            <img src={settings?.logoUrl || logoUrl} alt={settings?.siteName ?? "Ayden's Therapy Services"} className="h-full w-full object-cover object-top mix-blend-multiply" />
          </span>
          <span className="hidden max-w-[150px] text-[11px] font-extrabold uppercase leading-[1.15] tracking-[.1em] text-primary sm:block">{settings?.siteName ?? "Ayden's Therapy Services"}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <button data-testid="button-nav-about" onClick={() => { window.location.hash = content.navAboutUrl || '#about'; }} className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground transition-colors hover:text-destructive">
            {content.navAbout}
          </button>
          <button data-testid="button-nav-book" onClick={() => { window.location.hash = content.navBookUrl || '#book'; }} className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground transition-colors hover:text-destructive">
            {content.navBook}
          </button>
          <button data-testid="button-nav-wellness" onClick={() => { window.location.hash = content.navWellnessUrl || '#wellness-lookup'; }} className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground transition-colors hover:text-destructive">
            {content.navWellness}
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link href={content.navStaffUrl || "/staff/login"} data-testid="link-staff-portal" className="hidden text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive lg:inline-flex">
            {content.navStaff}
          </Link>
          <Link href={content.navClientPortalUrl || "/portal/login"} data-testid="link-client-portal" className="hidden text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive lg:inline-flex">
            {content.navClientPortal}
          </Link>
          <ThemeToggle compact />
          <Button data-testid="button-get-started" onClick={() => { window.location.hash = content.navRequestCallUrl || '#book'; }} className="bg-secondary px-4 text-secondary-foreground hover:bg-secondary/90 sm:px-5">
            {content.navRequestCall}
          </Button>
          <Button data-testid="button-mobile-menu" variant="outline" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? content.navCloseMenuLabel : content.navOpenMenuLabel}>
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {menuOpen && <div className="border-b border-border bg-background px-4 py-4 shadow-sm md:hidden">
        <div className="container mx-auto grid gap-1">
          <button data-testid="button-mobile-about" onClick={() => { window.location.hash = content.navAboutUrl || '#about'; setMenuOpen(false); }} className="w-full border-b border-border py-3 text-left text-sm font-semibold">{content.navAbout}</button>
          <button data-testid="button-mobile-book" onClick={() => { window.location.hash = content.navBookUrl || '#book'; setMenuOpen(false); }} className="w-full border-b border-border py-3 text-left text-sm font-semibold">{content.navBook}</button>
          <button data-testid="button-mobile-wellness" onClick={() => { window.location.hash = content.navWellnessUrl || '#wellness-lookup'; setMenuOpen(false); }} className="w-full border-b border-border py-3 text-left text-sm font-semibold">{content.navWellness}</button>
          <Link href="/staff/login" data-testid="link-mobile-staff" onClick={() => setMenuOpen(false)} className="border-b border-border py-3 text-sm font-semibold">{content.navStaff} {content.navStaffSuffix}</Link>
          <Link href="/portal/login" data-testid="link-mobile-client" onClick={() => setMenuOpen(false)} className="py-3 text-sm font-semibold">{content.navClientPortal}</Link>
        </div>
      </div>}
    </header>
  );
}

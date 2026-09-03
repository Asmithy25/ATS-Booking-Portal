import React from 'react';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { useGetSettings } from '@workspace/api-client-react';

export function PublicFooter() {
  const { data: settings } = useGetSettings();
  return (
    <footer id="contact" className="mt-auto border-t border-primary/20 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_.8fr_.8fr]">
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center bg-secondary p-1">
                <img src={settings?.logoUrl || logoUrl} alt={settings?.siteName ?? "Ayden's Therapy Services"} className="h-full w-full object-cover object-top mix-blend-multiply" />
              </span>
              <span className="max-w-[160px] text-[11px] font-extrabold uppercase leading-[1.15] tracking-[.1em]">{settings?.siteName ?? "Ayden's Therapy Services"}</span>
            </div>
            <p className="max-w-xs font-serif text-3xl leading-none text-secondary">{settings?.siteTagline ?? 'Heal. Grow. Thrive.'}</p>
          </div>
          
          <div className="flex flex-col items-start gap-4 text-left">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-secondary">Contact</h4>
            <div className="space-y-2 text-sm text-primary-foreground/70">
              <p>+1 (561) 291-8556</p>
              <p>aydenstherapyservices@gmail.com</p>
            </div>
          </div>
          
          <div className="flex flex-col items-start gap-4 text-left">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-secondary">Our practice</h4>
            <p className="max-w-xs text-sm leading-6 text-primary-foreground/70">
              We provide strictly over-the-phone consultations. There is no physical office, allowing you to access support from the comfort of your own space.
            </p>
          </div>
        </div>
        
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-primary-foreground/15 pt-6 text-[10px] uppercase tracking-[.12em] text-primary-foreground/55 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {settings?.siteName ?? "Ayden's Therapy Services"}</p>
          <p>Phone consultations only · no physical office</p>
        </div>
      </div>
    </footer>
  );
}

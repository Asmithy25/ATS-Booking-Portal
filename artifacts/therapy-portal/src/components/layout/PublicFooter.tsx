import React, { useEffect, useState } from 'react';
import { customFetch } from '@workspace/api-client-react';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { useGetSettings } from '@workspace/api-client-react';
import { getHomepageContent } from '@/lib/homepageContent';

export function PublicFooter() {
  const { data: settings } = useGetSettings();
  const [corporateBranding, setCorporateBranding] = useState<{ publicAttributionEnabled?: boolean; attributionText?: string; publicLogoUrl?: string } | null>(null);
  useEffect(() => {
    customFetch<{ publicAttributionEnabled?: boolean; attributionText?: string; publicLogoUrl?: string }>('/api/corporate/branding/public', { responseType: 'json' })
      .then(setCorporateBranding)
      .catch(() => setCorporateBranding(null));
  }, []);
  const content = getHomepageContent(settings);
  const websiteCustomizationEnabled = settings?.homepageContent?.websiteCustomizationEnabled === true;
  const brandName = websiteCustomizationEnabled && settings?.siteName ? settings.siteName : 'Aydens Wellness Services';
  const brandLogo = websiteCustomizationEnabled && settings?.logoUrl ? settings.logoUrl : logoUrl;
  const brandTagline = websiteCustomizationEnabled && settings?.siteTagline ? settings.siteTagline : 'Care That Meets You Where You Are';
  if (content.sectionVisibility?.footer === false) return null;
  return (
    <footer id="contact" className="mt-auto border-t border-primary/20 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_.8fr_.8fr]">
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center bg-secondary p-1">
                <img src={brandLogo} alt={brandName} className="h-full w-full object-cover object-top mix-blend-multiply" />
              </span>
              <span className="max-w-[160px] text-[11px] font-extrabold uppercase leading-[1.15] tracking-[.1em]">{brandName}</span>
            </div>
            <p className="max-w-xs font-serif text-3xl leading-none text-secondary">{brandTagline}</p>
          </div>
          
          <div className="flex flex-col items-start gap-4 text-left">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-secondary">{content.footerContactHeading}</h4>
            <div className="space-y-2 text-sm text-primary-foreground/70">
              <p>{content.contactPhone}</p>
              <p>{content.contactEmail}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-start gap-4 text-left">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-secondary">{content.footerPracticeHeading}</h4>
            <p className="max-w-xs text-sm leading-6 text-primary-foreground/70">
              {content.footerPracticeDescription}
            </p>
          </div>
        </div>
        
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-primary-foreground/15 pt-6 text-[10px] uppercase tracking-[.12em] text-primary-foreground/55 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {brandName}</p>
          <div className="flex flex-wrap items-center gap-4 sm:justify-end">
            <p>{content.footerCopyrightText}</p>
            {corporateBranding?.publicAttributionEnabled === true && <div className="inline-flex items-center gap-2 border-l border-primary-foreground/15 pl-4 text-primary-foreground/70"><img src={corporateBranding.publicLogoUrl || '/ash-corporate.webp'} alt="Ayden Smith Holdings" className="h-6 w-6 object-contain" /><span>{corporateBranding.attributionText || 'An Ayden Smith Holdings company'}</span></div>}
          </div>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import logoUrl from '@assets/ATS_FALL_1785938831030.png';
import { useGetSettings } from '@workspace/api-client-react';

export function PublicFooter() {
  const { data: settings } = useGetSettings();
  return (
    <footer className="bg-[hsl(25_29%_21%)] text-[hsl(38_42%_96%)] border-t border-primary/20 mt-auto">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <img src={settings?.logoUrl || logoUrl} alt={settings?.siteName ?? "Ayden's Therapy Services"} className="h-20 w-20 rounded-full object-cover object-top" />
            <p className="font-serif italic text-lg text-[hsl(35_45%_68%)]">{settings?.siteTagline ?? 'Heal. Grow. Thrive.'}</p>
          </div>
          
          <div className="flex flex-col items-center md:items-start gap-4 text-center md:text-left">
            <h4 className="font-serif font-bold">Contact</h4>
            <div className="space-y-2 text-[hsl(38_20%_78%)]">
              <p>+1 (561) 291-8556</p>
              <p>aydenstherapyservices@gmail.com</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-start gap-4 text-center md:text-left">
            <h4 className="font-serif font-bold">Our Practice</h4>
            <p className="text-[hsl(38_20%_78%)] max-w-xs">
              We provide strictly over-the-phone consultations. There is no physical office, allowing you to access support from the comfort of your own space.
            </p>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-[hsl(38_20%_78%_/.2)] flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[hsl(38_20%_68%)]">
           <p>© {new Date().getFullYear()} {settings?.siteName ?? "Ayden's Therapy Services"}. All rights reserved.</p>
          <p>Phone consultations only — no physical office</p>
        </div>
      </div>
    </footer>
  );
}

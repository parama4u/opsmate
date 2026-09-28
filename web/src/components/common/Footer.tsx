'use client';

import { useTranslations } from 'next-intl';
import { LogoMark } from '@/components/common/LogoMark';

export default function Footer() {
  const t = useTranslations('common');
  const tl = useTranslations('landing');
  const year = new Date().getFullYear();

  return (
    <footer className="-mx-5 mt-auto px-5 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark className="mt-0.5 h-8 w-8 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">{t('appName')}</p>
            <p className="mt-1">{tl('footerDescription')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href="#features" className="hover:text-foreground">{tl('navFeatures')}</a>
          <a href="#how-it-works" className="hover:text-foreground">{tl('navHowItWorks')}</a>
          <a href="#security" className="hover:text-foreground">{tl('navSecurity')}</a>
          <span>© {year} {t('appName')}</span>
        </div>
      </div>
    </footer>
  );
}

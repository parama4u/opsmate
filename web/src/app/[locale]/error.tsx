'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('Application route error', error.digest || 'unknown');
  }, [error.digest]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-bold">{t('errorTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{t('errorMessage')}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {t('retry')}
        </button>
        <Link href="/" className="border px-4 py-2 text-sm">
          {t('backToHome')}
        </Link>
      </div>
    </div>
  );
}

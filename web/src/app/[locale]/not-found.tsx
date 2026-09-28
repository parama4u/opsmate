import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{t('notFoundMessage')}</p>
      <Link
        href="/"
        className="mt-6 inline-block bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        {t('backToHome')}
      </Link>
    </div>
  );
}

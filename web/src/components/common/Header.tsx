'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { getFirebaseAuth, getAuthErrorMessage, signInWithGooglePopup } from '@/lib/auth/SimpleAuthProvider';
import { signOut } from 'firebase/auth';
import { routing, type Locale } from '@/i18n/routing';
import { LogoMark } from '@/components/common/LogoMark';

const localeOptions: Record<Locale, { labelKey: 'languageEnglish' | 'languageJapanese' }> = {
  en: { labelKey: 'languageEnglish' },
  ja: { labelKey: 'languageJapanese' },
};

export default function Header() {
  const t = useTranslations('common');
  const tl = useTranslations('landing');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSignInError(null);
    setSigningIn(true);
    try {
      await signInWithGooglePopup();
      router.push('/dashboard');
    } catch (error: unknown) {
      setSignInError(getAuthErrorMessage(error));
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      const auth = await getFirebaseAuth();
      await signOut(auth);
    } catch (error: unknown) {
      setSignOutError(getAuthErrorMessage(error));
    }
  };

  const switchLocale = (nextLocale: Locale) => {
    router.replace(pathname, { locale: nextLocale });
  };

  const selectedLocale = routing.locales.includes(locale as Locale) ? (locale as Locale) : routing.defaultLocale;

  return (
    <header className="sticky top-0 z-50 -mx-5 -mt-5 bg-background/95 px-5 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark className="h-8 w-8" />
            <span>{t('appName')}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <Link href="/#features" className="transition-colors hover:text-foreground">
              {tl('navFeatures')}
            </Link>
            <Link href="/#how-it-works" className="transition-colors hover:text-foreground">
              {tl('navHowItWorks')}
            </Link>
            <Link href="/#security" className="transition-colors hover:text-foreground">
              {tl('navSecurity')}
            </Link>
          </nav>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <Link href="/dashboard" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              {t('dashboard')}
            </Link>
          ) : null}
          <label className="relative flex border bg-background text-xs">
            <span className="sr-only">{t('languageSwitcher')}</span>
            <select
              value={selectedLocale}
              onChange={(event) => switchLocale(event.target.value as Locale)}
              className="appearance-none bg-transparent py-1 pl-2 pr-7 text-foreground outline-none transition-colors hover:bg-muted"
            >
              {routing.locales.map((loc) => (
                <option key={loc} value={loc}>
                  {t(localeOptions[loc].labelKey)}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
              ⌄
            </span>
          </label>
          {!loading &&
            (user ? (
              <div className="flex items-center gap-3">
                <span className="hidden max-w-36 truncate text-muted-foreground lg:inline">{user.email}</span>
                {signOutError ? <span role="alert" className="text-xs text-destructive">{signOutError}</span> : null}
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  {t('signOut')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {signInError ? <span role="alert" className="text-xs text-destructive">{signInError}</span> : null}
                <Button size="sm" onClick={handleSignIn} disabled={signingIn} aria-busy={signingIn}>
                  {signingIn ? t('signingIn') : t('signIn')}
                </Button>
              </div>
            ))}
        </nav>
      </div>
    </header>
  );
}

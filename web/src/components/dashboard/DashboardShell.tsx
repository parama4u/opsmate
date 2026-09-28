'use client';

import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { getAuthErrorMessage, signInWithGooglePopup } from '@/lib/auth/SimpleAuthProvider';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/common/LogoMark';
import { WorkspaceMenu, WorkspaceNavigationProvider } from '@/components/chat/workspaceNavigation';

export default function DashboardShell({ children }: { children: ReactNode }) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const { user, loading, isAdmin, role } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const nav = [
    { href: '/dashboard', key: 'dashboard' as const },
  ];
  const accountNav = [
    { href: '/settings', key: 'settings' as const },
    ...(isAdmin || role !== 'member' ? [{ href: '/admin', key: 'admin' as const }] : []),
  ];
  const mobileNav = [...nav, ...accountNav];

  const handleSignIn = async () => {
    setSignInError(null);
    setSigningIn(true);
    try {
      await signInWithGooglePopup();
    } catch (error: unknown) {
      setSignInError(getAuthErrorMessage(error));
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return <p className="py-12 text-muted-foreground">{tc('loading')}</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">{t('signInRequired')}</h1>
        <p className="mt-2 text-muted-foreground">{t('signInHint')}</p>
        {signInError ? <p role="alert" className="mt-4 text-sm text-destructive">{signInError}</p> : null}
        <Button className="mt-6" onClick={handleSignIn} disabled={signingIn} aria-busy={signingIn}>
          {signingIn ? tc('signingIn') : tc('signIn')}
        </Button>
      </div>
    );
  }

  return (
    <WorkspaceNavigationProvider>
      <div className="flex h-screen w-full gap-8">
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background md:hidden">
        {mobileNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 px-2 py-3 text-center text-xs',
              pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
            )}
          >
            {t(`nav.${item.key}`)}
          </Link>
        ))}
      </nav>
      <aside className="hidden w-64 shrink-0 flex-col md:flex">
        <Link href="/" className="mb-7 flex items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark className="h-8 w-8" />
          <span>{tc('appName')}</span>
        </Link>
        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <div key={item.href}>
                {item.href === '/dashboard' && pathname === '/dashboard' ? (
                  <WorkspaceMenu />
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'block px-3 py-2 text-sm transition-colors',
                      active ? 'font-medium text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
        {profileOpen ? (
          <div id="profile-menu" className="mt-3 space-y-1 pl-3">
            {accountNav.map((item) => (
              <Link key={item.href} href={item.href} className="block px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          aria-expanded={profileOpen}
          aria-controls="profile-menu"
          onClick={() => setProfileOpen((current) => !current)}
          className="mt-3 flex w-full items-center gap-3 bg-muted/30 px-3 py-3 text-left transition-colors hover:bg-muted/60"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
            {(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{user.displayName || tc('profile')}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
          {profileOpen ? <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
      </aside>
      <div className="min-h-0 min-w-0 flex-1 pb-14 md:pb-0">{children}</div>
      </div>
    </WorkspaceNavigationProvider>
  );
}

'use client';

import {
  ArrowDownRight,
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  FileCheck2,
  FileText,
  LifeBuoy,
  LockKeyhole,
  MessageCircleQuestion,
  MousePointer2,
  Search,
  ShieldCheck,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getAuthErrorMessage, signInWithGooglePopup } from '@/lib/auth/SimpleAuthProvider';

const problemScenes = [
  { image: '/problem-people-ops.png', label: 'problem1Label', title: 'problem1Title', description: 'problem1Description', href: '/hr-knowledge-base', linkKey: 'seoLink2' },
  { image: '/problem-onboarding.png', label: 'problem2Label', title: 'problem2Title', description: 'problem2Description', href: '/employee-onboarding-software', linkKey: 'seoLink3' },
  { image: '/problem-it-ops.png', label: 'problem3Label', title: 'problem3Title', description: 'problem3Description', href: '/internal-it-helpdesk', linkKey: 'seoLink5' },
] as const;

const workflowSteps = [
  { icon: FileText, title: 'step1Title', description: 'step1Description', href: '/internal-knowledge-base-software', linkKey: 'seoWorkflow1' },
  { icon: MessageCircleQuestion, title: 'step2Title', description: 'step2Description', href: '/employee-knowledge-base', linkKey: 'seoWorkflow2' },
  { icon: FileCheck2, title: 'step3Title', description: 'step3Description', href: '/knowledge-base-analytics', linkKey: 'seoWorkflow3' },
] as const;

const useCases = [
  { image: '/problem-people-ops.png', icon: UsersRound, label: 'useCase1Label', title: 'useCase1Title', description: 'useCase1Description', question: 'useCase1Question', source: 'useCase1Source', href: '/employee-self-service-software', linkKey: 'seoLink1' },
  { image: '/problem-onboarding.png', icon: BookOpenCheck, label: 'useCase2Label', title: 'useCase2Title', description: 'useCase2Description', question: 'useCase2Question', source: 'useCase2Source', href: '/employee-onboarding-software', linkKey: 'seoLink3' },
  { image: '/problem-it-ops.png', icon: LifeBuoy, label: 'useCase3Label', title: 'useCase3Title', description: 'useCase3Description', question: 'useCase3Question', source: 'useCase3Source', href: '/slack-employee-support', linkKey: 'seoLink4' },
] as const;

const securityItems = [
  { icon: LockKeyhole, title: 'security1Title', description: 'security1Description' },
  { icon: UsersRound, title: 'security2Title', description: 'security2Description' },
  { icon: ShieldCheck, title: 'security3Title', description: 'security3Description' },
] as const;

const proofSignals = [
  { icon: FileCheck2, key: 'proof1' },
  { icon: MessageCircleQuestion, key: 'proof2' },
  { icon: Zap, key: 'proof3' },
] as const;

export default function HomePage() {
  const t = useTranslations('landing');
  const common = useTranslations('common');
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [isCasePaused, setIsCasePaused] = useState(false);
  const [activeSecurity, setActiveSecurity] = useState(0);

  useEffect(() => {
    if (isCasePaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const interval = window.setInterval(() => {
      setActiveCase((currentCase) => (currentCase + 1) % useCases.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [isCasePaused]);

  const handleCta = async () => {
    if (user) {
      router.push('/dashboard');
      return;
    }
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

  return (
    <div className="mx-auto w-full max-w-7xl overflow-hidden">
      <section className="grid gap-12 pb-20 pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-28 lg:pt-20">
        <ScrollReveal className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t('eyebrow')}</p>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">{t('title')}</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">{t('subtitle')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {user ? (
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/dashboard">{t('cta')}<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button size="lg" className="h-12 px-6 text-base" onClick={handleCta} disabled={loading || signingIn} aria-busy={signingIn}>
                {signingIn ? common('signingIn') : t('cta')}<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <a href="#features" className="group inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-foreground transition-colors hover:text-primary">
              {t('secondaryCta')}<ArrowDownRight className="h-4 w-4 transition-transform group-hover:translate-y-1" />
            </a>
          </div>
          <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground">{t('ctaNote')}</p>
          {signInError ? <p role="alert" className="mt-3 text-sm text-destructive">{signInError}</p> : null}
        </ScrollReveal>
        <HeroVisual />
      </section>

      <div className="relative -mx-5 overflow-hidden bg-secondary py-4 sm:-mx-0">
        <div className="landing-marquee flex min-w-max items-center gap-10 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {[...proofSignals, ...proofSignals].map(({ icon: Icon, key }, index) => (
            <span key={`${key}-${index}`} aria-hidden={index >= proofSignals.length} className="inline-flex items-center gap-3 whitespace-nowrap">
              <Icon className="h-4 w-4 text-primary" />
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      <section id="features" className="py-20 lg:py-28">
        <ScrollReveal>
          <SectionIntro eyebrow={t('problemEyebrow')} title={t('problemTitle')} description={t('problemDescription')} />
        </ScrollReveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {problemScenes.map(({ image, label, title, description, href, linkKey }, index) => (
            <ScrollReveal key={image} delay={index * 120} className="group">
              <article>
                <Link href={href} className="relative block aspect-[4/3]">
                  <img src={image} alt={t(label)} className="landing-image-fade landing-drift h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" loading={index === 0 ? 'eager' : 'lazy'} />
                  <p className="absolute bottom-5 left-5 font-mono text-xs uppercase tracking-[0.18em] text-foreground">{t(label)}</p>
                </Link>
                <div className="pt-6">
                  <h3 className="max-w-sm text-xl font-semibold tracking-[-0.02em]">{t(title)}</h3>
                  <p className="mt-3 max-w-sm leading-7 text-muted-foreground">{t(description)}</p>
                  <Link href={href} className="group/link mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {t(linkKey)}<ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <ScrollReveal className="lg:sticky lg:top-24 lg:self-start">
            <SectionIntro eyebrow={t('workflowEyebrow')} title={t('workflowTitle')} description={t('workflowDescription')} />
            <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-primary">
              <MousePointer2 className="h-4 w-4" />
              <span>{t('secondaryCta')}</span>
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </ScrollReveal>
          <div className="relative space-y-10 pl-12 before:absolute before:bottom-10 before:left-[0.7rem] before:top-10 before:w-px before:bg-primary/40">
            {workflowSteps.map(({ icon: Icon, title, description, href, linkKey }, index) => (
              <ScrollReveal key={title} delay={index * 100}>
                <div className="group relative">
                  <div className="absolute -left-12 top-0 flex h-6 w-6 items-center justify-center bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-125">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{t(title)}</h3>
                  <p className="mt-3 max-w-xl leading-7 text-muted-foreground">{t(description)}</p>
                  <Link href={href} aria-label={t(linkKey)} className="group/link mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {t(linkKey)}<ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="use-cases"
        className="py-20 lg:py-28"
        onMouseEnter={() => setIsCasePaused(true)}
        onMouseLeave={() => setIsCasePaused(false)}
        onFocusCapture={() => setIsCasePaused(true)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setIsCasePaused(false);
          }
        }}
      >
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-20">
          <ScrollReveal>
            <SectionIntro eyebrow={t('useCasesEyebrow')} title={t('useCasesTitle')} description={t('useCasesDescription')} />
            <p className="mt-8 flex items-center gap-3 text-sm font-semibold text-primary"><MousePointer2 className="h-4 w-4" />{t('motionHint')}</p>
            <div className="mt-8 space-y-4">
              {useCases.map(({ icon: Icon, label, title, href, linkKey }, index) => (
                <CaseMotionButton key={label} index={index} icon={Icon} label={t(label)} title={t(title)} href={href} linkLabel={t(linkKey)} activeCase={activeCase} onSelect={setActiveCase} />
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <CaseMotion activeCase={activeCase} onNext={() => setActiveCase((activeCase + 1) % useCases.length)} />
          </ScrollReveal>
        </div>
      </section>

      <section id="fit" className="py-20 lg:py-28">
        <ScrollReveal className="landing-qualification relative overflow-hidden bg-primary p-8 text-primary-foreground sm:p-12 lg:p-16">
          <img src="/problem-people-ops.png" alt="" aria-hidden="true" className="landing-qualification-image absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-multiply" />
          <span aria-hidden="true" className="landing-qualification-wash absolute inset-0" />
          <span aria-hidden="true" className="landing-qualification-sheen absolute inset-y-0 left-0 w-1/3" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <div className="landing-qualification-copy">
              <p className="landing-qualification-eyebrow flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]"><CircleAlert className="h-4 w-4" />{t('fitEyebrow')}</p>
              <h2 className="landing-qualification-title mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{t('fitTitle')}</h2>
            </div>
            <div className="landing-qualification-detail">
              <p className="max-w-xl leading-7 text-primary-foreground/80">{t('fitDescription')}</p>
              <a href="#security" className="landing-qualification-link group mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                {t('securityEyebrow')}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section id="security" className="py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-20">
          <ScrollReveal>
            <SectionIntro eyebrow={t('securityEyebrow')} title={t('securityTitle')} />
            <div className="mt-10 space-y-3">
              {securityItems.map(({ icon: Icon, title }, index) => (
                <SecurityMotionButton key={title} index={index} icon={Icon} title={t(title)} activeSecurity={activeSecurity} onSelect={setActiveSecurity} />
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <SecurityMotion activeSecurity={activeSecurity} />
          </ScrollReveal>
        </div>
      </section>

      <section className="grid gap-10 py-20 lg:grid-cols-[1fr_0.7fr] lg:items-center lg:py-28">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t('finalEyebrow')}</p>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">{t('finalTitle')}</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{t('finalDescription')}</p>
          <Button size="lg" className="mt-8 h-12 px-6 text-base" onClick={handleCta} disabled={loading || signingIn}>
            {signingIn ? common('signingIn') : t('finalCta')}<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </ScrollReveal>
        <ScrollReveal delay={140} className="relative aspect-[4/3]">
          <img src="/problem-onboarding.png" alt="" aria-hidden="true" className="landing-image-fade landing-drift h-full w-full object-cover" />
          <div className="absolute bottom-6 left-6 flex items-center gap-3 text-sm font-semibold">
            <Check className="h-4 w-4 text-primary" />
            {t('preview.match')}
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}

function HeroVisual() {
  const t = useTranslations('landing');

  return (
    <div className="relative min-h-[28rem] sm:min-h-[34rem]">
      <div className="landing-float-slow absolute right-0 top-0 h-[72%] w-[76%]">
        <img src="/problem-people-ops.png" alt={t('problem1Label')} className="landing-image-fade h-full w-full object-cover" />
      </div>
      <div className="landing-float-delay absolute bottom-0 left-0 h-[57%] w-[58%]">
        <img src="/problem-onboarding.png" alt={t('problem2Label')} className="landing-image-fade h-full w-full object-cover" />
      </div>
      <div className="absolute bottom-10 right-[5%] flex items-center gap-3 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl">
        <MessageCircleQuestion className="h-5 w-5" />
        {t('preview.groundedAnswer')}
      </div>
      <div className="absolute left-[7%] top-[18%] flex items-center gap-3 bg-background/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground shadow-lg">
        <Workflow className="h-4 w-4 text-primary" />
        {t('preview.sourceLabel')} {t('preview.source')}
      </div>
    </div>
  );
}

interface CaseMotionButtonProps {
  index: number;
  icon: typeof UsersRound;
  label: string;
  title: string;
  href: string;
  linkLabel: string;
  activeCase: number;
  onSelect: (index: number) => void;
}

function CaseMotionButton({ index, icon: Icon, label, title, href, linkLabel, activeCase, onSelect }: CaseMotionButtonProps) {
  const isActive = activeCase === index;

  return (
    <div className={`group w-full py-4 transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
      <button
        type="button"
        onClick={() => onSelect(index)}
        onMouseEnter={() => onSelect(index)}
        onFocus={() => onSelect(index)}
        aria-pressed={isActive}
        className="flex w-full min-w-0 items-start gap-4 text-left"
      >
        <Icon className={`mt-1 h-5 w-5 shrink-0 transition-transform duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:scale-110 group-hover:text-primary'}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary">{label}</span>
          <span className="mt-1 block text-lg font-semibold tracking-[-0.02em]">{title}</span>
        </span>
      </button>
      <Link href={href} aria-label={linkLabel} className="group/context-link ml-9 mt-2 inline-flex items-center gap-2 text-xs font-semibold text-primary transition-colors hover:text-foreground">
        <span>{linkLabel}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover/context-link:translate-x-1" />
      </Link>
    </div>
  );
}

interface CaseMotionProps {
  activeCase: number;
  onNext: () => void;
}

function CaseMotion({ activeCase, onNext }: CaseMotionProps) {
  const t = useTranslations('landing');
  const currentCase = useCases[activeCase];
  const Icon = currentCase.icon;

  return (
    <div className="relative min-h-[30rem] overflow-hidden sm:min-h-[36rem]">
      <div key={currentCase.image} className="landing-swap absolute inset-0">
        <img src={currentCase.image} alt={t(currentCase.label)} className="landing-image-fade h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 p-7 pb-24 sm:p-10 sm:pb-28">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Icon className="h-4 w-4" />{t(currentCase.label)}</p>
          <h3 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{t(currentCase.title)}</h3>
          <p className="mt-5 max-w-lg text-lg font-semibold leading-7 text-foreground">&quot;{t(currentCase.question)}&quot;</p>
        </div>
        <div className="absolute bottom-7 right-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground sm:bottom-10 sm:right-10">
          <FileCheck2 className="h-4 w-4 text-primary" />
          {t('preview.sourceLabel')} {t(currentCase.source)}
        </div>
        <button type="button" onClick={onNext} className="absolute bottom-7 left-7 flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-primary sm:bottom-10 sm:left-10">
          {t('motionNext')}<ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute right-6 top-6 flex items-center gap-3 bg-background/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground sm:right-8 sm:top-8">
        <Search className="h-4 w-4 text-primary" />
        {t('preview.groundedAnswer')}
      </div>
    </div>
  );
}

interface SecurityMotionButtonProps {
  index: number;
  icon: typeof LockKeyhole;
  title: string;
  activeSecurity: number;
  onSelect: (index: number) => void;
}

function SecurityMotionButton({ index, icon: Icon, title, activeSecurity, onSelect }: SecurityMotionButtonProps) {
  const isActive = activeSecurity === index;

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      onMouseEnter={() => onSelect(index)}
      onFocus={() => onSelect(index)}
      aria-pressed={isActive}
      className={`group flex w-full items-center gap-4 py-3 text-left transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
        <Icon className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:scale-110 group-hover:text-primary'}`} />
        <span className="flex-1 text-lg font-semibold tracking-[-0.02em]">{title}</span>
      </button>
  );
}

interface SecurityMotionProps {
  activeSecurity: number;
}

function SecurityMotion({ activeSecurity }: SecurityMotionProps) {
  const t = useTranslations('landing');
  const currentSecurity = securityItems[activeSecurity];
  const Icon = currentSecurity.icon;

  return (
    <div className="landing-security-visual relative min-h-[30rem] overflow-hidden bg-secondary p-7 sm:min-h-[34rem] sm:p-10">
      <div aria-hidden="true" className="landing-security-grid absolute inset-0" />
      <div aria-hidden="true" className="landing-security-orbit absolute left-1/2 top-[42%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 sm:h-80 sm:w-80" />
      <div key={currentSecurity.title} className="landing-security-state absolute inset-x-7 top-8 bottom-8 flex flex-col justify-between sm:inset-x-10 sm:top-10 sm:bottom-10">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>{t('securityEyebrow')}</span>
          <span className="flex items-center gap-2 text-primary"><span className="landing-security-status h-2 w-2 bg-primary" />{t('preview.match')}</span>
        </div>
        <div className="relative z-10 max-w-xl">
          <div className="landing-security-icon flex h-16 w-16 items-center justify-center bg-primary text-primary-foreground">
            <Icon className="h-8 w-8" />
          </div>
          <h3 className="mt-7 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{t(currentSecurity.title)}</h3>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">{t(currentSecurity.description)}</p>
        </div>
        <div className="relative z-10 flex items-start gap-3 pt-5 text-sm leading-6 text-muted-foreground">
          <Search className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>{t('securityNote')}</span>
        </div>
      </div>
    </div>
  );
}

interface SectionIntroProps {
  eyebrow: string;
  title: string;
  description?: string;
}

function SectionIntro({ eyebrow, title, description }: SectionIntroProps) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h2>
      {description ? <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.14 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`landing-reveal ${isVisible ? 'landing-reveal-visible' : ''} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

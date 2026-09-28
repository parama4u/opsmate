import type { Metadata } from 'next';
import { ArrowRight, Check, FileCheck2, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getSeoPage, seoPageSlugs } from '@/lib/seo-pages';
import { pageMetadata } from '@/lib/seo';
import { siteUrl } from '@/lib/site';

interface SeoPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => seoPageSlugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: SeoPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const page = getSeoPage(locale, slug);

  if (!page) return pageMetadata({ noIndex: true });

  return pageMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: localizedPath(locale, page.slug),
  });
}

export default async function SeoLandingPage({ params }: SeoPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const page = getSeoPage(locale, slug);

  if (!page) notFound();

  const canonicalUrl = siteUrl(localizedPath(locale, page.slug));
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: page.metaTitle,
        description: page.metaDescription,
        url: canonicalUrl,
        isPartOf: { '@type': 'WebSite', name: 'OrgChai.com', url: siteUrl('/') },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'OrgChai',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: page.metaDescription,
        url: canonicalUrl,
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-7xl overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="grid gap-12 pb-20 pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-28 lg:pt-20">
        <div className="seo-page-enter relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{page.eyebrow}</p>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">{page.title}</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">{page.intro}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/" className="inline-flex h-12 items-center bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform hover:translate-x-1">
              {page.ctaLabel}<ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="group inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-foreground transition-colors hover:text-primary">
              {page.stepsTitle}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
        <div className="seo-page-enter relative aspect-[4/3] min-h-[24rem] overflow-hidden [animation-delay:140ms]">
          <img src={page.image} alt="" aria-hidden="true" className="landing-image-fade landing-drift h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-background/80 via-transparent to-primary/20" />
          <div className="absolute bottom-7 left-7 flex items-center gap-3 bg-background/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground sm:bottom-10 sm:left-10">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Source-backed answers
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why teams use it</p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{page.sectionsTitle}</h2>
          </div>
          <p className="max-w-md leading-7 text-muted-foreground">{page.fitDescription}</p>
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {page.sections.map((section, index) => (
            <article key={section.title} className="seo-page-card group" style={{ animationDelay: `${index * 100}ms` }}>
              <span className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-110">
                {index === 0 ? <ShieldCheck className="h-5 w-5" /> : index === 1 ? <MessageCircleQuestion className="h-5 w-5" /> : <Check className="h-5 w-5" />}
              </span>
              <h3 className="mt-7 text-xl font-semibold tracking-[-0.02em]">{section.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{section.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pilot plan</p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{page.stepsTitle}</h2>
          </div>
          <div className="space-y-10">
            {page.steps.map((step, index) => (
              <article key={step.title} className="seo-page-step group flex gap-5" style={{ animationDelay: `${index * 100}ms` }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-secondary text-primary transition-transform duration-300 group-hover:scale-110">
                  {index === 0 ? <FileCheck2 className="h-4 w-4" /> : index === 1 ? <MessageCircleQuestion className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.02em]">{step.title}</h3>
                  <p className="mt-2 max-w-xl leading-7 text-muted-foreground">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="bg-secondary p-8 sm:p-12 lg:p-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">A focused fit</p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{page.fitTitle}</h2>
            <p className="max-w-xl leading-7 text-muted-foreground">{page.fitDescription}</p>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Common questions</p>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">What buyers want to know</h2>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {page.faqs.map((faq) => (
            <article key={faq.question}>
              <h3 className="text-lg font-semibold tracking-[-0.02em]">{faq.question}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="relative overflow-hidden bg-primary p-8 text-primary-foreground sm:p-12 lg:p-16">
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Start with a focused source set</p>
            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{page.ctaTitle}</h2>
            <p className="mt-5 max-w-xl leading-7 text-primary-foreground/80">{page.ctaDescription}</p>
            <Link href="/" className="mt-8 inline-flex h-12 items-center bg-background px-6 text-base font-semibold text-foreground transition-transform hover:translate-x-1">
              {page.ctaLabel}<ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function localizedPath(locale: Locale, slug: string): string {
  return locale === routing.defaultLocale ? `/${slug}` : `/${locale}/${slug}`;
}

'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslations } from 'next-intl';
import { cn, safeExternalUrl } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  sources?: { text: string; source: string; score?: number; title?: string; source_url?: string | null; preview_url?: string | null; status?: string | null; owner?: string | null; subject_matter_expert?: string | null; reviewed_at?: string | null; expires_at?: string | null; provenance?: string | null; structured?: { steps: string[]; related_sources: string[] } }[];
  model?: string;
}

function highlightTerms(text: string, query: string): ReactNode {
  const terms = Array.from(new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []));
  if (terms.length === 0) return text;

  const escapedTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  return text.split(matcher).map((part, index) => (
    terms.includes(part.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : part
  ));
}

export function ChatMessages({
  messages,
  loading,
  onSuggest,
  onFeedback,
  feedbackPending = false,
  onProposeAction,
}: {
  messages: ChatMessage[];
  loading: boolean;
  onSuggest?: (question: string) => void;
  onFeedback?: (messageId: string, kind: 'helpful' | 'not_helpful' | 'incorrect' | 'missing_source' | 'report_concern') => void | Promise<void>;
  feedbackPending?: boolean;
  onProposeAction?: (question: string, message: ChatMessage) => void;
}) {
  const t = useTranslations('chat');
  const endRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ source: string; content: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const openPreview = async (source: string) => {
    setPreviewLoading(source);
    try {
      const response = await apiFetch<{ success: boolean; data: { content: string } }>(`/api/documents/${encodeURIComponent(source)}`);
      setPreview({ source, content: response.data.content });
    } catch {
      setPreview({ source, content: t('sourcePreviewUnavailable') });
    } finally {
      setPreviewLoading(null);
    }
  };

  const recordSourceClick = (source: string) => {
    void apiFetch('/api/sources/click', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }).catch(() => undefined);
  };

  useEffect(() => {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    const suggestions = [t('q1'), t('q2'), t('q3'), t('q4')];
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{t('startHere')}</p>
          <h2 className="text-2xl font-bold">{t('emptyTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('emptyHint')}</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                className="cursor-pointer bg-card/50 p-3 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => onSuggest?.(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((m, index) => (
          <div key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[85%] px-4 py-3 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border bg-card text-card-foreground'
              )}
            >
              {m.role === 'user' ? (
                <p>{m.content}</p>
              ) : (
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <p className="mb-1 text-xs font-medium text-primary">{t('sources')}</p>
                  {(() => {
                    const sourceQuery = messages.slice(0, index).reverse().find((message) => message.role === 'user')?.content || '';
                    return m.sources.map((s, i) => (
                    <div key={i} className="mb-1 bg-background/50 px-2 py-1 text-xs text-muted-foreground">
                      {(() => {
                        const sourceUrl = safeExternalUrl(s.source_url);
                        return <>
                      <span className="font-medium text-primary">{i + 1}. {s.title || s.source}</span>
                      {s.score ? <span className="float-right">{s.score.toFixed(2)}</span> : null}
                      <p className="mt-0.5 line-clamp-2">{highlightTerms(s.text, sourceQuery)}</p>
                      {s.structured?.steps?.length ? <div className="mt-2"><p className="text-[11px] font-medium text-primary">{t('stepsLabel')}</p><ol className="list-decimal pl-4 text-[11px]">{s.structured.steps.map((step, stepIndex) => <li key={`${s.source}-step-${stepIndex}`}>{step}</li>)}</ol></div> : null}
                      {s.structured?.related_sources?.length ? <p className="mt-1 text-[11px] text-muted-foreground">{t('relatedSourcesLabel')}: {s.structured.related_sources.join(', ')}</p> : null}
                      {(s.owner || s.subject_matter_expert || s.reviewed_at || s.expires_at || s.provenance) ? <p className="mt-1 text-[11px] text-muted-foreground">
                        {[s.owner ? `${t('ownerLabel')}: ${s.owner}` : null, s.subject_matter_expert ? `${t('smeLabel')}: ${s.subject_matter_expert}` : null, s.reviewed_at ? `${t('reviewedLabel')}: ${s.reviewed_at}` : null, s.expires_at ? `${t('expiresLabel')}: ${s.expires_at}` : null, s.provenance ? `${t('provenanceLabel')}: ${s.provenance}` : null].filter(Boolean).join(' · ')}
                      </p> : null}
                      <div className="mt-1 flex gap-3">
                        {sourceUrl ? <a className="text-primary underline" href={sourceUrl} target="_blank" rel="noreferrer" onClick={() => recordSourceClick(s.source)}>{t('openSource')}</a> : null}
                        <button type="button" className="text-primary underline" onClick={() => void openPreview(s.source)} disabled={previewLoading === s.source}>{previewLoading === s.source ? t('loadingSource') : t('previewSource')}</button>
                        <span>{s.status || t('sourceStatus')}</span>
                      </div>
                      {preview?.source === s.source ? <div className="mt-2 border-t pt-2 text-foreground"><p className="mb-1 text-[11px] font-medium text-primary">{t('sourcePreview')}</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs">{preview.content}</pre></div> : null}
                        </>;
                      })()}
                    </div>
                    ));
                  })()}
                </div>
              )}

              {m.role !== 'user' && (onFeedback || onProposeAction) ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-2 text-xs text-muted-foreground">
                  {onFeedback ? <>
                    <button type="button" disabled={feedbackPending} className="underline hover:text-foreground disabled:opacity-50" onClick={() => void onFeedback(m.id, 'helpful')}>{t('helpful')}</button>
                    <button type="button" disabled={feedbackPending} className="underline hover:text-foreground disabled:opacity-50" onClick={() => void onFeedback(m.id, 'not_helpful')}>{t('notHelpful')}</button>
                    <button type="button" disabled={feedbackPending} className="underline hover:text-foreground disabled:opacity-50" onClick={() => void onFeedback(m.id, 'incorrect')}>{t('incorrect')}</button>
                    <button type="button" disabled={feedbackPending} className="underline hover:text-foreground disabled:opacity-50" onClick={() => void onFeedback(m.id, 'missing_source')}>{t('missingSource')}</button>
                    <button type="button" disabled={feedbackPending} className="underline hover:text-foreground disabled:opacity-50" onClick={() => void onFeedback(m.id, 'report_concern')}>{t('reportConcern')}</button>
                  </> : null}
                  {onProposeAction ? <button type="button" className="underline hover:text-foreground" onClick={() => onProposeAction(messages.slice(0, index).reverse().find((message) => message.role === 'user')?.content || '', m)}>{t('proposeAction')}</button> : null}
                </div>
              ) : null}

              {m.model && m.role !== 'user' && (
                <p className="mt-2 text-xs text-muted-foreground/60">model: {m.model}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="flex gap-1 border bg-card px-4 py-3">
              <span className="h-2 w-2 animate-bounce bg-muted-foreground" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce bg-muted-foreground" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce bg-muted-foreground" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type ResponseMode = 'answer' | 'compare' | 'summarize' | 'checklist' | 'research';
type AnswerLanguage = 'default' | 'en' | 'ja';

export function ChatInput({ onSend, disabled, documents, initialValue = '' }: { onSend: (text: string, mode: ResponseMode, language: AnswerLanguage, contextSource?: string) => void; disabled: boolean; documents?: string[]; initialValue?: string }) {
  const t = useTranslations('chat');
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<ResponseMode>('answer');
  const [language, setLanguage] = useState<AnswerLanguage>('default');
  const [contextSource, setContextSource] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, mode, language, contextSource || undefined);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-background px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); autoGrow(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t('placeholder')}
          className="flex-1 resize-none border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="response-mode">{t('responseMode')}</label>
          <select id="response-mode" value={mode} onChange={(event) => setMode(event.target.value as ResponseMode)} disabled={disabled} className="border bg-card px-2 py-1 text-xs text-foreground">
            <option value="answer">{t('modeAnswer')}</option>
            <option value="compare">{t('modeCompare')}</option>
            <option value="summarize">{t('modeSummarize')}</option>
            <option value="checklist">{t('modeChecklist')}</option>
            <option value="research">{t('modeResearch')}</option>
          </select>
          <label className="sr-only" htmlFor="answer-language">{t('answerLanguage')}</label>
          <select id="answer-language" value={language} onChange={(event) => setLanguage(event.target.value as AnswerLanguage)} disabled={disabled} className="border bg-card px-2 py-1 text-xs text-foreground">
            <option value="default">{t('languageDefault')}</option>
            <option value="en">{t('languageEnglish')}</option>
            <option value="ja">{t('languageJapanese')}</option>
          </select>
          {documents && documents.length > 0 ? <>
            <label className="sr-only" htmlFor="context-source">{t('contextSource')}</label>
            <select id="context-source" value={contextSource} onChange={(event) => setContextSource(event.target.value)} disabled={disabled} className="max-w-40 border bg-card px-2 py-1 text-xs text-foreground">
              <option value="">{t('noContextSource')}</option>
              {documents.map((document) => <option key={document} value={document}>{document}</option>)}
            </select>
          </> : null}
          <Button size="icon" aria-label={t('sendMessage')} onClick={handleSend} disabled={disabled || !value.trim()} className="h-10 w-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 12 7-7 7 7M12 19V5" />
          </svg>
          </Button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground/60">
        {t('footer')}
      </p>
    </div>
  );
}

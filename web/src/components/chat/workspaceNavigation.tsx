'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import { FileText, ListChecks, MessageSquare, Search, Users, Workflow, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type WorkspaceTab = 'chats' | 'docs' | 'search' | 'people' | 'workflows' | 'recaps';
const workspaceItems: Array<{ id: WorkspaceTab; labelKey: 'documents' | WorkspaceTab; icon: LucideIcon }> = [
  { id: 'chats', labelKey: 'chats', icon: MessageSquare },
  { id: 'search', labelKey: 'search', icon: Search },
  { id: 'people', labelKey: 'people', icon: Users },
  { id: 'docs', labelKey: 'documents', icon: FileText },
  { id: 'workflows', labelKey: 'workflows', icon: Workflow },
  { id: 'recaps', labelKey: 'recaps', icon: ListChecks },
];

interface WorkspaceNavigationContextValue {
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
}

const WorkspaceNavigationContext = createContext<WorkspaceNavigationContextValue | null>(null);

export function WorkspaceNavigationProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<WorkspaceTab>('chats');

  return (
    <WorkspaceNavigationContext.Provider value={{ tab, setTab }}>
      {children}
    </WorkspaceNavigationContext.Provider>
  );
}

export function useWorkspaceNavigation() {
  const context = useContext(WorkspaceNavigationContext);
  if (!context) throw new Error('useWorkspaceNavigation must be used inside WorkspaceNavigationProvider');
  return context;
}

export function WorkspaceMenu() {
  const t = useTranslations('chat');
  const { tab, setTab } = useWorkspaceNavigation();

  return (
    <nav aria-label={t('workspaceLabel')} className="mt-4 space-y-1 pl-2">
      {workspaceItems.map(({ id, labelKey, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={cn(
            'flex w-full items-center gap-3 px-2 py-2 text-left text-sm transition-colors',
            tab === id ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className={cn('h-4 w-4 shrink-0', tab === id ? 'text-primary' : 'text-muted-foreground/70')} />
          <span>{t(labelKey)}</span>
          {tab === id ? <span className="ml-auto h-1.5 w-1.5 bg-primary" aria-hidden="true" /> : null}
        </button>
      ))}
    </nav>
  );
}

'use client';

import { ReactNode, useState, useCallback } from 'react';
import { FileText, MessageSquare, Plus, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { safeExternalUrl } from '@/lib/utils';
import { LogoMark } from '@/components/common/LogoMark';
import { useWorkspaceNavigation, WorkspaceMenu } from '@/components/chat/workspaceNavigation';
import { useCollections, useCreateSlackDigest, useCreateWorkflowProposal, usePeopleSearch, useRunSlackDigest, useSavedSearches, useSaveSearch, useSearch, useSlackDigests, useSlackStatus, useSlackSummary, useWorkflows } from '@/lib/query/hooks';

interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface ChatShellProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  documents: Record<string, number>;
  onUploadDocument: (file: File) => void | Promise<void>;
  onDeleteDocument: (name: string) => void;
  canManageDocuments?: boolean;
  children: ReactNode;
}

export function ChatShell({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  documents,
  onUploadDocument,
  onDeleteDocument,
  canManageDocuments = false,
  children,
}: ChatShellProps) {
  const t = useTranslations('chat');
  const { tab } = useWorkspaceNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchSourceSystem, setSearchSourceSystem] = useState('');
  const [searchTopic, setSearchTopic] = useState('');
  const [searchOwner, setSearchOwner] = useState('');
  const [searchDepartment, setSearchDepartment] = useState('');
  const [searchEffectiveFrom, setSearchEffectiveFrom] = useState('');
  const [searchEffectiveTo, setSearchEffectiveTo] = useState('');
  const [searchCollection, setSearchCollection] = useState('');
  const [savedSearchName, setSavedSearchName] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, string>>({});
  const [slackChannelId, setSlackChannelId] = useState('');
  const [slackThreadTs, setSlackThreadTs] = useState('');
  const [slackLanguage, setSlackLanguage] = useState<'default' | 'en' | 'ja'>('default');
  const [slackSchedule, setSlackSchedule] = useState<'on_demand' | 'hourly' | 'daily'>('on_demand');
  const [slackDestination, setSlackDestination] = useState('');
  const search = useSearch();
  const collections = useCollections();
  const savedSearches = useSavedSearches();
  const saveSearch = useSaveSearch();
  const people = usePeopleSearch();
  const workflows = useWorkflows();
  const createWorkflow = useCreateWorkflowProposal();
  const slackSummary = useSlackSummary();
  const slackStatus = useSlackStatus();
  const slackDigests = useSlackDigests();
  const createSlackDigest = useCreateSlackDigest();
  const runSlackDigest = useRunSlackDigest();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await onUploadDocument(file);
      e.target.value = '';
    } catch {
      setUploadError(t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  }, [onUploadDocument]);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {sidebarOpen && (
        <aside className="flex w-72 shrink-0 flex-col bg-secondary/20">
          <div className="md:hidden">
            <WorkspaceMenu />
          </div>
          <div className="px-4 py-4">
            <button type="button" className="flex w-full items-center gap-2 px-1 py-2 text-left text-sm font-medium text-primary transition-colors hover:text-foreground" onClick={onNewChat}>
              <Plus className="h-4 w-4" /> {t('newChat')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {tab === 'chats' ? (
              chats.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t('noChats')}</p>
              ) : (
                chats.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-current={c.id === activeChatId ? 'page' : undefined}
                    onClick={() => onSelectChat(c.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectChat(c.id);
                      }
                    }}
                    className={cn(
                      'group flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors',
                      c.id === activeChatId ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <span className="flex items-center gap-2 overflow-hidden">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`${t('deleteChat')}: ${c.title}`}
                      onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id); }}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                    </button>
                  </div>
                ))
              )
            ) : tab === 'docs' ? (
              <>
                {canManageDocuments ? (
                  <div className="mb-3 flex gap-2 px-1">
                    <label className="flex-1 cursor-pointer border border-input bg-background px-3 py-2 text-center text-xs hover:bg-accent">
                      <Upload className="mr-1 inline h-3 w-3" /> {t('chooseFile')}
                      <input type="file" accept=".txt,.md,.markdown,.html,.htm,.csv,.tsv,.rtf,.docx,.xlsx,.pptx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff" className="hidden" onChange={handleFileChange} disabled={uploading} />
                    </label>
                  </div>
                ) : null}
                {uploadError ? <p role="alert" className="px-1 text-xs text-red-700">{uploadError}</p> : null}
                {Object.keys(documents).length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t('noDocs')}</p>
                ) : (
                  Object.entries(documents).map(([name, count]) => (
                    <div
                      key={name}
                      className="group flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    >
                      <span className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{name} <span className="text-muted-foreground/60">({count})</span></span>
                      </span>
                      {canManageDocuments ? (
                        <button
                          type="button"
                          aria-label={`${t('deleteDocument')}: ${name}`}
                          onClick={() => onDeleteDocument(name)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </>
            ) : tab === 'search' ? (
              <form className="space-y-2 px-1" onSubmit={(event) => {
                event.preventDefault();
                const query = searchQuery.trim();
                if (query) search.mutate({ query, status: searchStatus, sourceSystem: searchSourceSystem, owner: searchOwner, topic: searchTopic, department: searchDepartment, effectiveFrom: searchEffectiveFrom, effectiveTo: searchEffectiveTo, collectionId: searchCollection });
              }}>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('searchPlaceholder')} className="w-full border bg-background px-2 py-2 text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={searchCollection} onChange={(event) => setSearchCollection(event.target.value)} aria-label={t('collectionFilter')} className="col-span-2 border bg-background px-2 py-2 text-xs"><option value="">{t('allCollections')}</option>{(collections.data ?? []).map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>
                  <input value={searchSourceSystem} onChange={(event) => setSearchSourceSystem(event.target.value)} placeholder={t('sourceSystemFilter')} className="border bg-background px-2 py-2 text-xs" />
                  <input value={searchStatus} onChange={(event) => setSearchStatus(event.target.value)} placeholder={t('statusFilter')} className="border bg-background px-2 py-2 text-xs" />
                  <input value={searchOwner} onChange={(event) => setSearchOwner(event.target.value)} placeholder={t('ownerFilter')} className="border bg-background px-2 py-2 text-xs" />
                  <input value={searchDepartment} onChange={(event) => setSearchDepartment(event.target.value)} placeholder={t('departmentFilter')} className="border bg-background px-2 py-2 text-xs" />
                  <input value={searchTopic} onChange={(event) => setSearchTopic(event.target.value)} placeholder={t('topicFilter')} className="border bg-background px-2 py-2 text-xs" />
                  <input type="date" value={searchEffectiveFrom} onChange={(event) => setSearchEffectiveFrom(event.target.value)} aria-label={t('effectiveFrom')} className="border bg-background px-2 py-2 text-xs" />
                  <input type="date" value={searchEffectiveTo} onChange={(event) => setSearchEffectiveTo(event.target.value)} aria-label={t('effectiveTo')} className="border bg-background px-2 py-2 text-xs" />
                </div>
                <button type="submit" disabled={search.isPending || !searchQuery.trim()} className="w-full border px-2 py-2 text-xs disabled:opacity-50">{t('runSearch')}</button>
                <div className="flex gap-2">
                  <input value={savedSearchName} onChange={(event) => setSavedSearchName(event.target.value)} placeholder={t('savedSearchName')} className="min-w-0 flex-1 border bg-background px-2 py-2 text-xs" />
                  <button type="button" disabled={!savedSearchName.trim() || !searchQuery.trim() || saveSearch.isPending} className="border px-2 py-2 text-xs disabled:opacity-50" onClick={() => { saveSearch.mutate({ name: savedSearchName.trim(), query: searchQuery.trim(), filters: { status: searchStatus, source_system: searchSourceSystem, owner: searchOwner, topic: searchTopic, department: searchDepartment, effective_from: searchEffectiveFrom, effective_to: searchEffectiveTo, collection_id: searchCollection } }); setSavedSearchName(''); }}>{t('saveSearch')}</button>
                </div>
                <div className="space-y-2 pt-2">
                  {(search.data?.results ?? []).map((result, index) => (
                    <article key={`${result.source}-${index}`} className="border p-2 text-xs">
                      <p className="font-medium">{result.title || result.source}</p>
                      <p className="mt-1 line-clamp-3 text-muted-foreground">{result.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{result.status || t('sourceStatus')}</p>
                    </article>
                  ))}
                  {search.isSuccess && (search.data?.results.length ?? 0) === 0 ? <p className="py-3 text-center text-xs text-muted-foreground">{t('noSearchResults')}</p> : null}
                  {search.isError ? <p role="alert" className="py-2 text-xs text-red-700">{t('actionFailed')}</p> : null}
                  {(savedSearches.data ?? []).length > 0 ? <p className="pt-2 text-[11px] text-muted-foreground">{t('savedSearches')}: {(savedSearches.data ?? []).map((saved) => saved.name).join(', ')}</p> : null}
                  {saveSearch.isError ? <p role="alert" className="py-2 text-xs text-red-700">{t('actionFailed')}</p> : null}
                </div>
              </form>
            ) : tab === 'people' ? (
              <form className="space-y-2 px-1" onSubmit={(event) => {
                event.preventDefault();
                people.mutate(peopleQuery.trim());
              }}>
                <input value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder={t('peoplePlaceholder')} className="w-full border bg-background px-2 py-2 text-xs" />
                <button type="submit" disabled={people.isPending} className="w-full border px-2 py-2 text-xs disabled:opacity-50">{t('findPeople')}</button>
                <div className="space-y-2 pt-2">
                  {(people.data ?? []).map((person) => <article key={`${person.role}-${person.name}`} className="border p-2 text-xs"><p className="font-medium">{person.name}</p><p className="text-muted-foreground">{person.role}{person.department ? ` · ${person.department}` : ''}</p><p className="mt-1 text-muted-foreground">{person.sources.join(', ')}</p></article>)}
                  {people.isSuccess && (people.data?.length ?? 0) === 0 ? <p className="py-3 text-center text-xs text-muted-foreground">{t('noPeople')}</p> : null}
                  {people.isError ? <p role="alert" className="py-2 text-xs text-red-700">{t('actionFailed')}</p> : null}
                </div>
              </form>
            ) : tab === 'workflows' ? (
              <div className="space-y-2 px-1">
                <select value={workflowId} onChange={(event) => { setWorkflowId(event.target.value); setWorkflowInputs({}); }} className="w-full border bg-background px-2 py-2 text-xs">
                  <option value="">{t('chooseWorkflow')}</option>
                  {(workflows.data ?? []).map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.title}</option>)}
                </select>
                {workflows.data?.find((workflow) => workflow.id === workflowId) ? (() => {
                  const workflow = workflows.data.find((item) => item.id === workflowId);
                  if (!workflow) return null;
                  return <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); createWorkflow.mutate({ workflowId: workflow.id, inputs: workflowInputs, sourceIds: [], idempotencyKey: `workflow:${workflow.id}:${Date.now()}` }); }}>
                    <p className="text-xs text-muted-foreground">{workflow.description}</p>
                    {workflow.required_inputs.map((input) => <input key={input} required value={workflowInputs[input] || ''} onChange={(event) => setWorkflowInputs((current) => ({ ...current, [input]: event.target.value }))} placeholder={input} className="w-full border bg-background px-2 py-2 text-xs" />)}
                    <button type="submit" disabled={createWorkflow.isPending} className="w-full border px-2 py-2 text-xs disabled:opacity-50">{t('createWorkflowProposal')}</button>
                    {createWorkflow.isError ? <p role="alert" className="text-xs text-red-700">{t('actionFailed')}</p> : null}
                  </form>;
                })() : null}
              </div>
            ) : (
              <form className="space-y-2 px-1" onSubmit={(event) => {
                event.preventDefault();
                if (!slackChannelId.trim()) return;
                const channelIds = slackChannelId.split(',').map((channel) => channel.trim()).filter(Boolean);
                if (slackSchedule === 'on_demand' && channelIds.length === 1) {
                  slackSummary.mutate({ channelId: channelIds[0], threadTs: slackThreadTs.trim() || undefined, language: slackLanguage });
                } else {
                  createSlackDigest.mutate({ channelIds, destinationChannel: slackDestination.trim() || undefined, schedule: slackSchedule, language: slackLanguage });
                }
              }}>
                <p className="text-xs text-muted-foreground">{t('recapsHint')}</p>
                {slackStatus.data && !slackStatus.data.ready ? <p className="border border-red-200 p-2 text-xs text-red-700">{t('slackNotReady')}: {(slackStatus.data.scopes?.required_missing ?? []).join(', ') || t('slackUnavailable')}</p> : null}
                <input value={slackChannelId} onChange={(event) => setSlackChannelId(event.target.value)} placeholder={t('slackChannelId')} className="w-full border bg-background px-2 py-2 text-xs" required />
                <input value={slackThreadTs} onChange={(event) => setSlackThreadTs(event.target.value)} placeholder={t('slackThreadTs')} className="w-full border bg-background px-2 py-2 text-xs" />
                <input value={slackDestination} onChange={(event) => setSlackDestination(event.target.value)} placeholder={t('slackDestination')} className="w-full border bg-background px-2 py-2 text-xs" />
                <select value={slackSchedule} onChange={(event) => setSlackSchedule(event.target.value as 'on_demand' | 'hourly' | 'daily')} className="w-full border bg-background px-2 py-2 text-xs">
                  <option value="on_demand">{t('scheduleOnDemand')}</option>
                  <option value="hourly">{t('scheduleHourly')}</option>
                  <option value="daily">{t('scheduleDaily')}</option>
                </select>
                <select value={slackLanguage} onChange={(event) => setSlackLanguage(event.target.value as 'default' | 'en' | 'ja')} className="w-full border bg-background px-2 py-2 text-xs">
                  <option value="default">{t('languageDefault')}</option>
                  <option value="en">{t('languageEnglish')}</option>
                  <option value="ja">{t('languageJapanese')}</option>
                </select>
                <button type="submit" disabled={!slackStatus.data?.ready || slackSummary.isPending || createSlackDigest.isPending} className="w-full border px-2 py-2 text-xs disabled:opacity-50">{slackSchedule === 'on_demand' ? t('createRecap') : t('saveDigest')}</button>
                {slackSummary.data ? <article className="border p-2 text-xs"><p className="whitespace-pre-wrap">{slackSummary.data.summary}</p>{safeExternalUrl(slackSummary.data.source_url) ? <a href={safeExternalUrl(slackSummary.data.source_url) ?? undefined} target="_blank" rel="noreferrer" className="mt-2 inline-block text-primary underline">{t('openSlackSource')}</a> : null}</article> : null}
                {slackSummary.isError ? <p className="text-xs text-red-500">{t('recapUnavailable')}</p> : null}
                {createSlackDigest.isError || runSlackDigest.isError ? <p role="alert" className="text-xs text-red-700">{t('actionFailed')}</p> : null}
                {(slackDigests.data ?? []).length > 0 ? <div className="space-y-2 pt-2"><p className="text-xs font-medium">{t('savedDigests')}</p>{(slackDigests.data ?? []).map((digest) => <article key={digest.id} className="border p-2 text-xs"><p>{digest.channel_ids.join(', ')} · {digest.schedule}</p><button type="button" className="mt-1 text-primary underline" disabled={runSlackDigest.isPending} onClick={() => runSlackDigest.mutate(digest.id)}>{t('runDigest')}</button></article>)}</div> : null}
              </form>
            )}
          </div>

          <div className="bg-background/20 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('knowledgeBase')}</p>
            <p className="mt-1 text-xs text-foreground">{t('indexedSources', { count: Object.keys(documents).length })}</p>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span className="text-lg">&#9776;</span>
          </Button>
          <LogoMark className="h-6 w-6 shrink-0" />
          <span className="truncate text-sm font-medium">OrgChai</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="truncate text-sm text-muted-foreground">{tab === 'docs' ? t('documents') : t(tab)}</span>
        </header>
        {children}
      </div>
    </div>
  );
}

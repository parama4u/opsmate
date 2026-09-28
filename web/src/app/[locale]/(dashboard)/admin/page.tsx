'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiDownload } from '@/lib/api';
import { AdminPolicy, DocumentRecord, RetentionPolicy, useActionProposals, useAnalytics, useApplyRetentionPolicy, useAudit, useBackups, useCollections, useConnectors, useCreateBackup, useCreateCollection, useCreateConnector, useCreateEvaluationCase, useDecideActionProposal, useDeleteDirectoryUser, useDirectoryUsers, useDocuments, useEvaluations, useGlossary, useHealth, useMcpCapabilities, useMcpToolCheck, usePolicies, useReviews, useRunEvaluations, useSaveGlossary, useSourceHealth, useSyncConnector, useUpdateAdminPolicy, useUpdateConnector, useUpdateDlpPolicy, useUpdateDocumentMetadata, useUpdateReview, useUpdateRetentionPolicy, useUpsertDirectoryUser } from '@/lib/query/hooks';

export default function AdminPage() {
  const t = useTranslations('admin');
  const { user, isAdmin, role } = useAuth();
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [retentionStatus, setRetentionStatus] = useState<string | null>(null);
  const [dlpStatus, setDlpStatus] = useState<string | null>(null);
  const [adminPolicyStatus, setAdminPolicyStatus] = useState<string | null>(null);
  const [dlpAction, setDlpAction] = useState<'flag' | 'redact' | 'block'>('flag');
  const [adminPolicy, setAdminPolicy] = useState<AdminPolicy>({ approved_connector_kinds: ['local_folder', 'google_drive', 'sharepoint', 'rest_api'], approved_models: [], web_access: 'disabled', allowed_data_classes: ['internal', 'personal', 'restricted'], allowed_tools: ['search', 'source_preview', 'draft_actions'], action_scopes: ['draft_follow_up', 'draft_incident_summary', 'draft_onboarding_plan', 'draft_it_access_request', 'draft_policy_acknowledgement', 'draft_support_reply'] });
  const [retentionConfirmation, setRetentionConfirmation] = useState('');
  const [retentionValues, setRetentionValues] = useState<RetentionPolicy>({
    chat_days: 0,
    source_copy_days: 0,
    embedding_days: 0,
    audit_event_days: 0,
    metrics_days: 0,
    feedback_days: 0,
  });
  const canAccessAdmin = Boolean(user) && (isAdmin || role !== 'member');
  const canReview = isAdmin || ['reviewer', 'analyst', 'auditor'].includes(role);
  const canAnalyze = isAdmin || ['analyst', 'auditor'].includes(role);
  const canAudit = isAdmin || role === 'auditor';
  const canManageKnowledge = isAdmin || ['knowledge_owner', 'reviewer'].includes(role);
  const canEvaluate = isAdmin || ['analyst', 'reviewer'].includes(role);
  const canListConnectors = isAdmin || ['connector_admin', 'analyst', 'auditor'].includes(role);
  const docs = useDocuments(canAccessAdmin);
  const health = useHealth(canAccessAdmin);
  const mcpCapabilities = useMcpCapabilities(canAccessAdmin);
  const mcpToolCheck = useMcpToolCheck();
  const reviews = useReviews(canReview);
  const analytics = useAnalytics(canAnalyze);
  const sourceHealth = useSourceHealth(canListConnectors || canAnalyze);
  const policies = usePolicies(canAnalyze);
  const identityProvider = policies.data?.identity_provider ?? {
    provider_id: 'google.com',
    provider_type: 'google',
    enterprise_sso_configured: false,
    scim_configured: false,
    scim_endpoint: '/api/scim/v2',
  };
  const updateRetention = useUpdateRetentionPolicy();
  const applyRetention = useApplyRetentionPolicy();
  const updateDlp = useUpdateDlpPolicy();
  const updateAdminPolicy = useUpdateAdminPolicy();
  const audit = useAudit(canAudit);
  const backups = useBackups(canAnalyze);
  const createBackup = useCreateBackup();
  const updateReview = useUpdateReview();
  const updateDocument = useUpdateDocumentMetadata();
  const connectors = useConnectors(canListConnectors);
  const createConnector = useCreateConnector();
  const syncConnector = useSyncConnector();
  const updateConnector = useUpdateConnector();
  const proposals = useActionProposals(canAccessAdmin);
  const decideProposal = useDecideActionProposal();
  const canManageConnectors = isAdmin || role === 'connector_admin';
  const directoryUsers = useDirectoryUsers(canManageConnectors || role === 'auditor');
  const upsertDirectoryUser = useUpsertDirectoryUser();
  const deleteDirectoryUser = useDeleteDirectoryUser();
  const collections = useCollections(canManageKnowledge);
  const createCollection = useCreateCollection();
  const glossary = useGlossary(canManageKnowledge);
  const saveGlossary = useSaveGlossary();
  const evaluations = useEvaluations(canEvaluate);
  const createEvaluationCase = useCreateEvaluationCase();
  const runEvaluations = useRunEvaluations();

  useEffect(() => {
    if (policies.data?.retention) setRetentionValues(policies.data.retention);
    if (policies.data?.dlp_action === 'flag' || policies.data?.dlp_action === 'redact' || policies.data?.dlp_action === 'block') setDlpAction(policies.data.dlp_action);
    if (policies.data) setAdminPolicy({
      approved_connector_kinds: policies.data.approved_connector_kinds.split(',').map((value) => value.trim()).filter(Boolean),
      approved_models: String(policies.data.approved_models || '').split(',').map((value) => value.trim()).filter(Boolean),
      web_access: policies.data.web_access || 'disabled',
      allowed_data_classes: String(policies.data.allowed_data_classes || 'internal,personal,restricted').split(',').map((value) => value.trim()).filter(Boolean),
      allowed_tools: String(policies.data.allowed_tools || 'search,source_preview,draft_actions').split(',').map((value) => value.trim()).filter(Boolean),
      action_scopes: policies.data.action_allowlist.split(',').map((value) => value.trim()).filter(Boolean),
    });
  }, [policies.data]);

  const downloadExport = async (path: string, filename: string) => {
    setDownloadStatus(null);
    try {
      await apiDownload(path, filename);
      setDownloadStatus(t('exportSuccess'));
    } catch {
      setDownloadStatus(t('exportError'));
    }
  };

  if (!user) return null;

  if (!canAccessAdmin) {
    return (
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('forbidden')}</p>
      </div>
    );
  }

  const docCount = Object.keys(docs.data?.documents ?? {}).length;
  const chunks = health.data?.chunks ?? docs.data?.total_chunks ?? 0;
  const documentRecords: DocumentRecord[] = docs.data?.records ?? Object.entries(docs.data?.documents ?? {}).map(([source, documentChunks]) => ({
    source,
    chunks: documentChunks,
    status: 'draft',
    allowed_emails: [],
    allowed_domains: [],
    allowed_groups: [],
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="border p-4">
          <p className="text-sm text-muted-foreground">{t('chunks')}</p>
          <p className="mt-1 text-2xl font-bold">{chunks}</p>
        </div>
        <div className="border p-4">
          <p className="text-sm text-muted-foreground">{t('docs')}</p>
          <p className="mt-1 text-2xl font-bold">{docCount}</p>
        </div>
        <div className="border p-4">
          <p className="text-sm text-muted-foreground">{t('db')}</p>
          <p className="mt-1 text-2xl font-bold">{health.data?.db ? 'ok' : 'offline'}</p>
        </div>
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t('qualityTitle')}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('feedback')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.feedback_total ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('openReviews')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.open_reviews ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('reviewedItems')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.review_total ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('activeUsers')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.active_users ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('questions')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.questions ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('sourceClicks')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.source_clicks ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('feedbackRate')}</p><p className="mt-1 text-2xl font-bold">{((analytics.data?.feedback_rate ?? 0) * 100).toFixed(0)}%</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('p95Latency')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.p95_latency_ms ?? 0} ms</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('estimatedCost')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.estimated_usage_cost ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('approvalRate')}</p><p className="mt-1 text-2xl font-bold">{((analytics.data?.approval_rate ?? 0) * 100).toFixed(0)}%</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('humanHandoffs')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.human_handoffs ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('noResultQueries')}</p><p className="mt-1 text-2xl font-bold">{analytics.data?.no_result_queries ?? 0}</p></div>
          <div className="border p-4"><p className="text-sm text-muted-foreground">{t('staleSources')}</p><p className="mt-1 text-2xl font-bold">{(sourceHealth.data?.expired ?? 0) + (sourceHealth.data?.expiring_soon ?? 0)}</p></div>
        </div>
        <div className="mt-4 space-y-3">
          {(reviews.data ?? []).filter((review) => review.status !== 'dismissed').map((review) => (
            <article key={review.id} className="border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{review.kind} · {review.status}</p>
                  <p className="mt-1 text-sm font-medium">{review.question || t('unknownQuestion')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{review.answer}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => updateReview.mutate({ id: review.id, status: 'in_review' })}>{t('startReview')}</button>
                  <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => updateReview.mutate({ id: review.id, status: 'resolved' })}>{t('resolve')}</button>
                  <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => updateReview.mutate({ id: review.id, status: 'dismissed' })}>{t('dismiss')}</button>
                </div>
              </div>
            </article>
          ))}
          {(reviews.data ?? []).filter((review) => review.status !== 'dismissed').length === 0 ? <p className="text-sm text-muted-foreground">{t('noReviews')}</p> : null}
        </div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('mcpTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('mcpDescription')}</p>
        <p className="mt-3 text-sm">{mcpCapabilities.data ? `${mcpCapabilities.data.transport} · ${mcpCapabilities.data.protocol_version} · ${mcpCapabilities.data.read_only ? t('readOnly') : t('notConfigured')}` : t('notConfigured')}</p>
        {mcpCapabilities.data ? <p className="mt-1 text-xs text-muted-foreground">{mcpCapabilities.data.tools.map((tool) => tool.name).join(', ')} · {mcpCapabilities.data.audit_events.join(', ')}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => mcpToolCheck.mutate()} disabled={mcpToolCheck.isPending}>{t('mcpCheck')}</button>{mcpToolCheck.isSuccess ? <span role="status" className="text-xs text-muted-foreground">{t('mcpCheckPassed')}</span> : null}{mcpToolCheck.isError ? <span role="alert" className="text-xs text-red-700">{t('mcpCheckFailed')}</span> : null}</div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('evaluationTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('evaluationHint')}</p>
        <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          createEvaluationCase.mutate({ title: String(form.get('evaluationTitle') || ''), question: String(form.get('evaluationQuestion') || ''), expectedSources: String(form.get('evaluationSources') || '').split(',').map((source) => source.trim()).filter(Boolean), language: String(form.get('evaluationLanguage') || 'default') as 'default' | 'en' | 'ja' });
          event.currentTarget.reset();
        }}>
          <input name="evaluationTitle" required placeholder={t('evaluationCaseTitle')} className="border bg-background px-2 py-2 text-sm" />
          <input name="evaluationQuestion" required placeholder={t('evaluationQuestion')} className="border bg-background px-2 py-2 text-sm" />
          <input name="evaluationSources" placeholder={t('evaluationSources')} className="border bg-background px-2 py-2 text-sm" />
          <select name="evaluationLanguage" aria-label={t('evaluationLanguage')} defaultValue="default" className="border bg-background px-2 py-2 text-sm"><option value="default">{t('languageDefault')}</option><option value="en">{t('languageEnglish')}</option><option value="ja">{t('languageJapanese')}</option></select>
          <button type="submit" className="border px-3 py-2 text-sm hover:bg-muted sm:col-span-3">{t('addEvaluation')}</button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm">{t('evaluationCases')}: {evaluations.data?.cases.length ?? 0}</span><button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => runEvaluations.mutate()}>{t('runEvaluation')}</button>{evaluations.data?.runs[0] ? <><span className="text-sm text-muted-foreground">{t('hitRate')}: {(evaluations.data.runs[0].hit_rate * 100).toFixed(0)}% · MRR: {evaluations.data.runs[0].mean_reciprocal_rank.toFixed(2)} · {evaluations.data.runs[0].model || t('notConfigured')} · {evaluations.data.runs[0].prompt_version || t('notConfigured')}</span>{Object.entries(evaluations.data.runs[0].by_language ?? {}).map(([language, metrics]) => <span key={language} className="text-xs text-muted-foreground">{language}: {(metrics.hit_rate * 100).toFixed(0)}% / {metrics.mean_reciprocal_rank.toFixed(2)} MRR</span>)}</> : null}</div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('discoveryTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('discoveryHint')}</p>
        <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          createCollection.mutate({ name: String(form.get('collectionName') || ''), description: String(form.get('collectionDescription') || ''), sourceIds: String(form.get('collectionSources') || '').split(',').map((source) => source.trim()).filter(Boolean), authoritative: form.get('authoritative') === 'on', boost: Number(form.get('boost') || 0) });
          event.currentTarget.reset();
        }}>
          <input name="collectionName" required placeholder={t('collectionName')} className="border bg-background px-2 py-2 text-sm" />
          <input name="collectionDescription" placeholder={t('collectionDescription')} className="border bg-background px-2 py-2 text-sm" />
          <input name="collectionSources" placeholder={t('collectionSources')} className="border bg-background px-2 py-2 text-sm" />
          <input name="boost" type="number" min="0" max="10" defaultValue="0" placeholder={t('boost')} className="border bg-background px-2 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input name="authoritative" type="checkbox" /> {t('authoritative')}</label>
          <button type="submit" className="border px-3 py-2 text-sm hover:bg-muted">{t('addCollection')}</button>
        </form>
        <div className="mt-4 space-y-2 text-sm">{(collections.data ?? []).map((collection) => <div key={collection.id} className="border px-3 py-2">{collection.name} · {collection.source_ids.length} {t('sourcesCount')}{collection.authoritative ? ` · ${t('authoritative')}` : ''}</div>)}</div>
        <form className="mt-5 grid gap-2 sm:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          saveGlossary.mutate({ term: String(form.get('term') || ''), synonyms: String(form.get('synonyms') || '').split(',').map((term) => term.trim()).filter(Boolean), definition: String(form.get('definition') || '') });
          event.currentTarget.reset();
        }}>
          <input name="term" required placeholder={t('glossaryTerm')} className="border bg-background px-2 py-2 text-sm" />
          <input name="synonyms" placeholder={t('glossarySynonyms')} className="border bg-background px-2 py-2 text-sm" />
          <input name="definition" placeholder={t('glossaryDefinition')} className="border bg-background px-2 py-2 text-sm" />
          <button type="submit" className="border px-3 py-2 text-sm hover:bg-muted sm:col-span-3">{t('saveGlossary')}</button>
        </form>
        <div className="mt-3 text-xs text-muted-foreground">{(glossary.data ?? []).map((term) => `${term.term}: ${term.synonyms.join(', ')}`).join(' · ')}</div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('actionTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('actionHint')}</p>
        <div className="mt-4 space-y-3">
          {(proposals.data ?? []).map((proposal) => (
            <article key={proposal.id} className="border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{proposal.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{proposal.action_type} · {proposal.status} · {proposal.requester || t('systemActor')}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{proposal.permission_scope}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('proposalInputs')}: {Object.entries(proposal.inputs).map(([key, value]) => `${key}=${value}`).join(' · ') || t('none')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('proposalSources')}: {proposal.source_ids.join(', ') || t('none')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('proposalEffects')}: {proposal.expected_side_effects.join(' · ') || t('none')}</p>
                </div>
                {(isAdmin || role === 'reviewer') && proposal.status === 'pending' ? <div className="flex gap-2">
                  <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => decideProposal.mutate({ id: proposal.id, status: 'approved' })}>{t('approve')}</button>
                  <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => decideProposal.mutate({ id: proposal.id, status: 'rejected' })}>{t('reject')}</button>
                </div> : null}
              </div>
            </article>
          ))}
          {(proposals.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t('noActions')}</p> : null}
        </div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('backupsTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('backupsHint')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>{backups.data?.configured ? t('backupsConfigured') : t('backupsUnavailable')}</span>
          <span className="text-muted-foreground">{t('backupRetention')}: {backups.data?.retention_count ?? '7'}</span>
          <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => createBackup.mutate()} disabled={!backups.data?.configured || createBackup.isPending}>{t('createBackup')}</button>
        </div>
        {backups.data?.records[0] ? <p role="status" className="mt-2 text-xs text-muted-foreground">{t('lastBackup')}: {backups.data.records[0].filename} · {new Date(backups.data.records[0].verified_at).toLocaleString()}</p> : null}
        {createBackup.isError ? <p role="alert" className="mt-2 text-xs text-red-700">{t('backupFailed')}</p> : null}
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('directoryTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('directoryHint')}</p>
        {canManageConnectors ? <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          upsertDirectoryUser.mutate({ externalId: String(form.get('externalId') || ''), email: String(form.get('directoryEmail') || ''), displayName: String(form.get('directoryName') || ''), groups: String(form.get('directoryGroups') || '').split(',').map((value) => value.trim()).filter(Boolean), roles: String(form.get('directoryRoles') || '').split(',').map((value) => value.trim()).filter(Boolean), active: true });
          event.currentTarget.reset();
        }}>
          <input name="externalId" required placeholder={t('externalId')} className="border bg-background px-2 py-2 text-sm" />
          <input name="directoryEmail" type="email" required placeholder={t('directoryEmail')} className="border bg-background px-2 py-2 text-sm" />
          <input name="directoryName" placeholder={t('directoryName')} className="border bg-background px-2 py-2 text-sm" />
          <input name="directoryGroups" placeholder={t('directoryGroups')} className="border bg-background px-2 py-2 text-sm" />
          <input name="directoryRoles" placeholder={t('directoryRoles')} className="border bg-background px-2 py-2 text-sm" />
          <button type="submit" className="border px-3 py-2 text-sm hover:bg-muted">{t('saveDirectoryUser')}</button>
        </form> : null}
        <div className="mt-4 space-y-2">{(directoryUsers.data ?? []).map((directoryUser) => <div key={directoryUser.external_id} className="flex flex-wrap items-center justify-between gap-3 border px-3 py-2 text-sm"><div><p className="font-medium">{directoryUser.display_name || directoryUser.email}</p><p className="text-xs text-muted-foreground">{directoryUser.email} · {directoryUser.groups.join(', ') || t('noGroups')} · {directoryUser.roles.join(', ') || 'member'}</p></div>{canManageConnectors ? <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => deleteDirectoryUser.mutate(directoryUser.external_id)}>{t('removeDirectoryUser')}</button> : null}</div>)}</div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('connectorTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('connectorHint')}</p>
        {canManageConnectors ? <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          createConnector.mutate({ name: String(form.get('connectorName') || ''), kind: String(form.get('connectorKind') || 'local_folder') as 'local_folder' | 'google_drive' | 'sharepoint' | 'rest_api', rootPath: String(form.get('rootPath') || ''), tokenEnv: String(form.get('tokenEnv') || ''), scopeId: String(form.get('scopeId') || ''), driveId: String(form.get('driveId') || ''), endpointUrl: String(form.get('endpointUrl') || ''), integrationCategory: String(form.get('integrationCategory') || ''), schedule: String(form.get('schedule') || ''), retryLimit: Number(form.get('retryLimit') || 3), retryBackoffSeconds: Number(form.get('retryBackoffSeconds') || 5), webhookSecretEnv: String(form.get('webhookSecretEnv') || '') });
          event.currentTarget.reset();
        }}>
          <input name="connectorName" required placeholder={t('connectorName')} className="border bg-background px-2 py-2 text-sm" />
          <select name="connectorKind" defaultValue="local_folder" className="border bg-background px-2 py-2 text-sm"><option value="local_folder">{t('localFolder')}</option><option value="google_drive">{t('googleDrive')}</option><option value="sharepoint">{t('sharepoint')}</option><option value="rest_api">{t('restApi')}</option></select>
          <input name="rootPath" placeholder={t('rootPath')} className="border bg-background px-2 py-2 text-sm" />
          <input name="tokenEnv" placeholder={t('tokenEnv')} className="border bg-background px-2 py-2 text-sm" />
          <input name="scopeId" placeholder={t('scopeId')} className="border bg-background px-2 py-2 text-sm" />
          <input name="driveId" placeholder={t('driveId')} className="border bg-background px-2 py-2 text-sm" />
          <input name="endpointUrl" type="url" placeholder={t('endpointUrl')} className="border bg-background px-2 py-2 text-sm" />
          <select name="integrationCategory" defaultValue="ticketing" className="border bg-background px-2 py-2 text-sm"><option value="ticketing">{t('ticketing')}</option><option value="hr">{t('hr')}</option><option value="project_tracking">{t('projectTracking')}</option><option value="calendar">{t('calendar')}</option><option value="directory">{t('directory')}</option></select>
          <input name="schedule" placeholder={t('schedule')} className="border bg-background px-2 py-2 text-sm" />
          <input name="retryLimit" type="number" min="0" max="5" defaultValue="3" placeholder={t('retryLimit')} className="border bg-background px-2 py-2 text-sm" />
          <input name="retryBackoffSeconds" type="number" min="0" max="3600" defaultValue="5" placeholder={t('retryBackoffSeconds')} className="border bg-background px-2 py-2 text-sm" />
          <input name="webhookSecretEnv" placeholder={t('webhookSecretEnv')} className="border bg-background px-2 py-2 text-sm" />
          <button type="submit" className="border px-3 py-2 text-sm hover:bg-muted">{t('addConnector')}</button>
        </form> : null}
        <div className="mt-4 space-y-2">
          {(connectors.data ?? []).map((connector) => (
            <div key={connector.id} className="flex flex-wrap items-center justify-between gap-3 border px-3 py-2 text-sm">
              <div><p className="font-medium">{connector.name}</p><p className="text-xs text-muted-foreground">{connector.kind} · {connector.status} · {connector.indexed_sources?.length ?? 0} {t('indexed')} · {connector.stale_count ?? 0} {t('stale')} · {connector.failure_count ?? 0} {t('failures')}</p><p className="text-xs text-muted-foreground">{t('retryPolicy')}: {connector.retry_limit ?? 3} · {t('retryBackoffSeconds')}: {connector.retry_backoff_seconds ?? 5} · {t('retryCount')}: {connector.retry_count ?? 0}</p>{connector.contract ? <p className="max-w-3xl text-xs text-muted-foreground">{t('connectorContract')}: v{connector.contract.version} · {connector.contract.authentication.mode} · OAuth {connector.contract.authentication.oauth_status ?? (connector.kind === 'local_folder' ? 'not_applicable' : 'unknown')} · consent {connector.contract.authentication.admin_consent ?? (connector.kind === 'local_folder' ? 'not_applicable' : 'unknown')} · scope {connector.contract.crawl_scope.selection_status ?? (connector.kind === 'local_folder' && connector.contract.crawl_scope.root_path_configured ? 'selected' : 'action_required')} · {connector.contract.incremental.strategy} · {connector.contract.deletion.strategy} · {connector.contract.deletion.quarantined_count} {t('quarantined')} · {t('freshnessTarget')}: {connector.contract.deletion.freshness_target_seconds != null ? `${connector.contract.deletion.freshness_target_seconds}s` : t('manual')} · ACL {connector.contract.permissions.enforced_at.join(', ')} · {connector.contract.source_metadata.length} {t('metadataFields')} · {connector.contract.identities.directory_mapping ? t('identityMappingSupported') : t('identityMappingUnavailable')}</p> : null}{connector.last_success_at ? <p className="text-xs text-muted-foreground">{t('lastSuccess')}: {new Date(connector.last_success_at).toLocaleString()}</p> : null}{connector.last_sync_duration_ms != null ? <p className="text-xs text-muted-foreground">{connector.last_sync_duration_ms} ms</p> : null}{connector.last_error ? <p className="text-xs text-red-700">{connector.last_error}</p> : null}</div>
              {canManageConnectors ? <div className="flex flex-wrap gap-2"><button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => syncConnector.mutate(connector.id)} disabled={connector.status === 'paused'}>{t('syncNow')}</button><button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => updateConnector.mutate({ id: connector.id, status: connector.status === 'active' ? 'paused' : 'active' })}>{connector.status === 'active' ? t('pause') : t('resume')}</button><form className="flex gap-1" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateConnector.mutate({ id: connector.id, retryLimit: Number(form.get('retryLimit') || 0), retryBackoffSeconds: Number(form.get('retryBackoffSeconds') || 0) }); }}><input name="retryLimit" aria-label={t('retryLimit')} type="number" min="0" max="5" defaultValue={connector.retry_limit ?? 3} className="w-16 border px-1 py-1 text-xs" /><input name="retryBackoffSeconds" aria-label={t('retryBackoffSeconds')} type="number" min="0" max="3600" defaultValue={connector.retry_backoff_seconds ?? 5} className="w-20 border px-1 py-1 text-xs" /><button type="submit" className="border px-2 py-1 text-xs hover:bg-muted">{t('saveRetryPolicy')}</button></form></div> : null}
            </div>
          ))}
          {(connectors.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t('noConnectors')}</p> : null}
        </div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('auditTitle')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => void downloadExport('/api/admin/audit/export', 'orgchai-audit.json')}>{t('exportAudit')}</button>
          <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={() => void downloadExport('/api/admin/analytics/export', 'orgchai-analytics.json')}>{t('exportAnalytics')}</button>
        </div>
        {downloadStatus ? <p role="status" className="mt-2 text-xs text-muted-foreground">{downloadStatus}</p> : null}
        <div className="mt-3 space-y-2 text-sm">
          {(audit.data ?? []).slice(0, 20).map((entry) => (
            <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b pb-2">
              <span>{entry.event}</span><span className="text-muted-foreground">{entry.actor || t('systemActor')} · {new Date(entry.created_at).toLocaleString()}</span>
            </div>
          ))}
          {(audit.data ?? []).length === 0 ? <p className="text-muted-foreground">{t('noAudit')}</p> : null}
        </div>
      </section>
      <section className="mt-10 border p-4">
        <h2 className="text-xl font-semibold">{t('policyTitle')}</h2>
        {canAnalyze ? <div className="mt-4 border-t pt-4">
          <h3 className="font-medium">{t('retentionConfigTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('retentionDescription')}</p>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            setRetentionStatus(null);
            updateRetention.mutate(retentionValues, { onSuccess: () => setRetentionStatus(t('retentionSaved')) });
          }}>
            <label className="text-sm">{t('chatPromptAnswer')}<input type="number" min="0" max="36500" value={retentionValues.chat_days} onChange={(event) => setRetentionValues((current) => ({ ...current, chat_days: Number(event.target.value) }))} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('sourceCopies')}<input type="number" min="0" max="36500" value={retentionValues.source_copy_days} onChange={(event) => setRetentionValues((current) => ({ ...current, source_copy_days: Number(event.target.value) }))} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('embeddings')}<input type="number" min="0" max="36500" value={retentionValues.embedding_days} onChange={(event) => setRetentionValues((current) => ({ ...current, embedding_days: Number(event.target.value) }))} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('auditEvents')}<input type="number" min="0" max="36500" value={retentionValues.audit_event_days} onChange={(event) => setRetentionValues((current) => ({ ...current, audit_event_days: Number(event.target.value) }))} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('metrics')}<input type="number" min="0" max="36500" value={retentionValues.metrics_days} onChange={(event) => setRetentionValues((current) => ({ ...current, metrics_days: Number(event.target.value) }))} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('feedbackRetention')}<input type="number" min="0" max="36500" value={retentionValues.feedback_days} onChange={(event) => setRetentionValues((current) => ({ ...current, feedback_days: Number(event.target.value) }))} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <button type="submit" className="border px-3 py-2 text-sm hover:bg-muted" disabled={updateRetention.isPending}>{t('saveRetention')}</button>
              {retentionStatus ? <span role="status" className="text-sm text-muted-foreground">{retentionStatus}</span> : null}
            </div>
          </form>
          <form className="mt-4 border-t pt-4" onSubmit={(event) => {
            event.preventDefault();
            if (retentionConfirmation !== 'APPLY RETENTION') return;
            applyRetention.mutate(undefined, { onSuccess: (result) => { setRetentionStatus(`${t('retentionApplied')}: ${Object.values(result.removed).reduce((total, count) => total + count, 0)}`); setRetentionConfirmation(''); } });
          }}>
            <p className="text-sm text-muted-foreground">{t('applyRetentionDescription')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={retentionConfirmation} onChange={(event) => setRetentionConfirmation(event.target.value)} placeholder={t('applyRetentionConfirmation')} aria-label={t('applyRetentionConfirmation')} className="border bg-background px-2 py-1 text-sm" />
              <button type="submit" disabled={retentionConfirmation !== 'APPLY RETENTION' || applyRetention.isPending} className="border border-red-700 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50">{t('applyRetention')}</button>
            </div>
          </form>
        </div> : null}
        {canAnalyze ? <form className="mt-4 border-t pt-4" onSubmit={(event) => {
          event.preventDefault();
          setDlpStatus(null);
          updateDlp.mutate(dlpAction, { onSuccess: () => setDlpStatus(t('dlpSaved')) });
        }}>
          <h3 className="font-medium">{t('dlpTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('dlpDescription')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm"><span className="sr-only">{t('dlpAction')}</span><select value={dlpAction} onChange={(event) => setDlpAction(event.target.value as 'flag' | 'redact' | 'block')} className="border bg-background px-2 py-1" aria-label={t('dlpAction')}><option value="flag">flag</option><option value="redact">redact</option><option value="block">block</option></select></label>
            <button type="submit" className="border px-3 py-1 text-sm hover:bg-muted" disabled={updateDlp.isPending}>{t('saveDlp')}</button>
            {dlpStatus ? <span role="status" className="text-sm text-muted-foreground">{dlpStatus}</span> : null}
          </div>
        </form> : null}
        {canAnalyze ? <form className="mt-4 border-t pt-4" onSubmit={(event) => {
          event.preventDefault();
          setAdminPolicyStatus(null);
          const form = new FormData(event.currentTarget);
          const nextPolicy: AdminPolicy = {
            approved_connector_kinds: String(form.get('approvedConnectorKinds') || '').split(',').map((value) => value.trim()).filter(Boolean),
            approved_models: String(form.get('approvedModels') || '').split(',').map((value) => value.trim()).filter(Boolean),
            web_access: String(form.get('webAccess') || 'disabled') as AdminPolicy['web_access'],
            allowed_data_classes: String(form.get('allowedDataClasses') || '').split(',').map((value) => value.trim()).filter(Boolean),
            allowed_tools: String(form.get('allowedTools') || '').split(',').map((value) => value.trim()).filter(Boolean),
            action_scopes: String(form.get('actionScopes') || '').split(',').map((value) => value.trim()).filter(Boolean),
          };
          updateAdminPolicy.mutate(nextPolicy, { onSuccess: () => { setAdminPolicy(nextPolicy); setAdminPolicyStatus(t('adminPolicySaved')); } });
        }}>
          <h3 className="font-medium">{t('adminPolicyTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('adminPolicyDescription')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('policyConnectorKinds')}<input name="approvedConnectorKinds" defaultValue={adminPolicy.approved_connector_kinds.join(', ')} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('policyModels')}<input name="approvedModels" defaultValue={adminPolicy.approved_models.join(', ')} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('policyDataClasses')}<input name="allowedDataClasses" defaultValue={adminPolicy.allowed_data_classes.join(', ')} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('policyTools')}<input name="allowedTools" defaultValue={adminPolicy.allowed_tools.join(', ')} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('policyActions')}<input name="actionScopes" defaultValue={adminPolicy.action_scopes.join(', ')} className="mt-1 w-full border bg-background px-2 py-1" /></label>
            <label className="text-sm">{t('webAccess')}<select name="webAccess" defaultValue={adminPolicy.web_access} className="mt-1 w-full border bg-background px-2 py-1" aria-label={t('webAccess')}><option value="disabled">{t('webAccessDisabled')}</option><option value="approved_only">{t('webAccessApprovedOnly')}</option><option value="enabled">{t('webAccessEnabled')}</option></select></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="submit" className="border px-3 py-1 text-sm hover:bg-muted" disabled={updateAdminPolicy.isPending}>{t('saveAdminPolicy')}</button>{adminPolicyStatus ? <span role="status" className="text-sm text-muted-foreground">{adminPolicyStatus}</span> : null}</div>
        </form> : null}
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">{t('modelProvider')}</dt><dd>{policies.data?.model_provider || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('noTraining')}</dt><dd>{policies.data?.no_training || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('providerRetention')}</dt><dd>{policies.data?.provider_retention || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('chatRetention')}</dt><dd>{policies.data?.chat_retention_days ?? t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('sourcePermissions')}</dt><dd>{policies.data?.source_permissions || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('organizationBoundary')}</dt><dd>{policies.data?.organization_id || t('notConfigured')} · {policies.data?.organization_boundary?.mode || t('notConfigured')} · {policies.data?.organization_boundary?.claim || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('dlpAction')}</dt><dd>{policies.data?.dlp_action || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('dataResidency')}</dt><dd>{policies.data?.data_residency || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('regionalProcessing')}</dt><dd>{policies.data?.regional_processing || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('secretsRotation')}</dt><dd>{policies.data?.secrets_rotation_days || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('encryptionAtRest')}</dt><dd>{policies.data?.encryption_at_rest || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('dataExport')}</dt><dd>{policies.data?.data_export || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('deletionConfirmation')}</dt><dd>{policies.data?.deletion_confirmation || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('identityProvider')}</dt><dd>{identityProvider.provider_type} · {identityProvider.provider_id}</dd></div>
          <div><dt className="text-muted-foreground">{t('scimProvisioning')}</dt><dd>{identityProvider.scim_configured ? `${t('configured')} · ${identityProvider.scim_endpoint}` : t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('approvedConnectors')}</dt><dd>{policies.data?.approved_connector_kinds || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('actionAllowlist')}</dt><dd>{policies.data?.action_allowlist || t('notConfigured')}</dd></div>
          <div><dt className="text-muted-foreground">{t('webAccess')}</dt><dd>{policies.data?.web_access || t('notConfigured')}</dd></div>
        </dl>
      </section>
      <ul className="mt-8 space-y-2 text-sm">
        {documentRecords.map((document) => (
          <li key={document.source} className="border px-3 py-3">
            <form>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{document.title || document.source} ({document.chunks})</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{document.status || 'draft'}</span>
                  <span className="text-xs text-muted-foreground">{document.data_classification || 'internal'}</span>
                  <select name="status" aria-label={`${document.source} status`} className="border bg-background px-2 py-1 text-xs" defaultValue={document.status || 'draft'}>
                    {['draft', 'approved', 'verified', 'expired', 'archived', 'superseded'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select name="data_classification" aria-label={`${document.source} data classification`} className="border bg-background px-2 py-1 text-xs" defaultValue={document.data_classification || 'internal'}>
                    {['internal', 'personal', 'restricted'].map((classification) => <option key={classification} value={classification}>{classification}</option>)}
                  </select>
                  <button type="button" className="border px-3 py-1 text-xs hover:bg-muted" onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (!form) return;
                    const values = new FormData(form);
                    updateDocument.mutate({
                      name: document.source,
                      title: String(values.get('title') || ''),
                      status: String(values.get('status') || 'draft'),
                      owner: String(values.get('owner') || ''),
                      subject_matter_expert: String(values.get('subject_matter_expert') || ''),
                      allowed_emails: String(values.get('allowed_emails') || ''),
                      allowed_domains: String(values.get('allowed_domains') || ''),
                      allowed_groups: String(values.get('allowed_groups') || ''),
                      source_system: String(values.get('source_system') || ''),
                      topic: String(values.get('topic') || ''),
                      department: String(values.get('department') || ''),
                      source_url: String(values.get('source_url') || ''),
                      last_reviewed_at: String(values.get('last_reviewed_at') || ''),
                      effective_date: String(values.get('effective_date') || ''),
                      expiration_date: String(values.get('expiration_date') || ''),
                      data_classification: String(values.get('data_classification') || 'internal') as 'internal' | 'personal' | 'restricted',
                    });
                  }}>{t('saveMetadata')}</button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input name="title" aria-label={`${document.source} title`} defaultValue={document.title || ''} placeholder={t('metadataTitle')} className="border bg-background px-2 py-1 text-xs" />
                <input name="owner" aria-label={`${document.source} owner`} defaultValue={document.owner || ''} placeholder={t('owner')} className="border bg-background px-2 py-1 text-xs" />
                <input name="subject_matter_expert" aria-label={`${document.source} subject matter expert`} defaultValue={document.subject_matter_expert || ''} placeholder={t('subjectMatterExpert')} className="border bg-background px-2 py-1 text-xs" />
                <input name="allowed_emails" aria-label={`${document.source} allowed emails`} defaultValue={document.allowed_emails?.join(', ') || ''} placeholder={t('allowedEmails')} className="border bg-background px-2 py-1 text-xs" />
                <input name="allowed_domains" aria-label={`${document.source} allowed domains`} defaultValue={document.allowed_domains?.join(', ') || ''} placeholder={t('allowedDomains')} className="border bg-background px-2 py-1 text-xs" />
                <input name="allowed_groups" aria-label={`${document.source} allowed groups`} defaultValue={document.allowed_groups?.join(', ') || ''} placeholder={t('allowedGroups')} className="border bg-background px-2 py-1 text-xs" />
                <input name="source_system" aria-label={`${document.source} source system`} defaultValue={document.source_system || ''} placeholder={t('sourceSystem')} className="border bg-background px-2 py-1 text-xs" />
                <input name="topic" aria-label={`${document.source} topic`} defaultValue={document.topic || ''} placeholder={t('topic')} className="border bg-background px-2 py-1 text-xs" />
                <input name="department" aria-label={`${document.source} department`} defaultValue={document.department || ''} placeholder={t('department')} className="border bg-background px-2 py-1 text-xs" />
                <input name="source_url" aria-label={`${document.source} source URL`} defaultValue={document.source_url || ''} placeholder={t('sourceUrl')} className="border bg-background px-2 py-1 text-xs" />
                <input name="last_reviewed_at" type="date" aria-label={`${document.source} review date`} defaultValue={document.last_reviewed_at || ''} className="border bg-background px-2 py-1 text-xs" />
                <input name="effective_date" type="date" aria-label={`${document.source} effective date`} defaultValue={document.effective_date || ''} className="border bg-background px-2 py-1 text-xs" />
                <input name="expiration_date" type="date" aria-label={`${document.source} expiration date`} defaultValue={document.expiration_date || ''} className="border bg-background px-2 py-1 text-xs" />
              </div>
              {document.duplicate_of ? <p className="mt-2 text-xs text-amber-700">{t('duplicateOf')}: {document.duplicate_of}</p> : null}
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

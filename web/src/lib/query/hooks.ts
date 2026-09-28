'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ChatSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  sources?: SourceCitation[];
  model?: string;
}

export interface SourceCitation {
  text: string;
  source: string;
  score?: number;
  title?: string;
  source_url?: string | null;
  preview_url?: string | null;
  status?: string | null;
  owner?: string | null;
  subject_matter_expert?: string | null;
  allowed_emails?: string[];
  allowed_domains?: string[];
  allowed_groups?: string[];
  duplicate_of?: string | null;
  source_system?: string;
  topic?: string | null;
  department?: string | null;
  data_classification?: 'internal' | 'personal' | 'restricted' | null;
  dlp_findings?: Record<string, number>;
  history?: { at: string; actor?: string | null; note?: string }[];
  reviewed_at?: string | null;
  expires_at?: string | null;
  provenance?: string | null;
  structured?: { steps: string[]; owner?: string | null; subject_matter_expert?: string | null; reviewed_at?: string | null; effective_date?: string | null; expiration_date?: string | null; related_sources: string[] };
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface DocumentsPayload {
  total_chunks: number;
  documents: Record<string, number>;
  records?: DocumentRecord[];
}

export interface DocumentRecord {
  source: string;
  title?: string;
  source_url?: string | null;
  status?: string;
  owner?: string | null;
  subject_matter_expert?: string | null;
  source_system?: string;
  topic?: string | null;
  department?: string | null;
  data_classification?: 'internal' | 'personal' | 'restricted' | null;
  dlp_findings?: Record<string, number>;
  allowed_emails?: string[];
  allowed_domains?: string[];
  allowed_groups?: string[];
  duplicate_of?: string | null;
  last_reviewed_at?: string | null;
  effective_date?: string | null;
  expiration_date?: string | null;
  chunks: number;
}

export function useChats(enabled = true) {
  return useQuery({
    queryKey: ['chats'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: ChatSummary[] }>('/api/chats');
      return res.data ?? [];
    },
  });
}

export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: ['chat', chatId],
    enabled: Boolean(chatId),
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: ChatSession }>(`/api/chats/${chatId}`);
      return res.data;
    },
  });
}

export interface SearchResult extends SourceCitation {
  title?: string;
}

export function useSearch() {
  return useMutation({
    mutationFn: async ({ query, sourceSystem, status, owner, topic, department, effectiveFrom, effectiveTo, collectionId }: { query: string; sourceSystem?: string; status?: string; owner?: string; topic?: string; department?: string; effectiveFrom?: string; effectiveTo?: string; collectionId?: string }) => {
      const res = await apiFetch<{ success: boolean; data: { query: string; results: SearchResult[] } }>('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query, source_system: sourceSystem, status, owner, topic, department, effective_from: effectiveFrom || undefined, effective_to: effectiveTo || undefined, collection_id: collectionId || undefined }),
      });
      return res.data;
    },
  });
}

export interface CollectionRecord {
  id: string;
  name: string;
  description?: string | null;
  source_ids: string[];
  authoritative: boolean;
  boost: number;
}

export function useCollections(enabled = true) {
  return useQuery({
    queryKey: ['collections'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: CollectionRecord[] }>('/api/collections');
      return res.data ?? [];
    },
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description, sourceIds, authoritative, boost }: { name: string; description?: string; sourceIds: string[]; authoritative: boolean; boost: number }) => apiFetch('/api/admin/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description, source_ids: sourceIds, authoritative, boost }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['collections'] }); },
  });
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, string>;
  created_at: string;
}

export function useSavedSearches(enabled = true) {
  return useQuery({
    queryKey: ['saved-searches'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: SavedSearch[] }>('/api/saved-searches');
      return res.data ?? [];
    },
  });
}

export function useSaveSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, query, filters }: { name: string; query: string; filters: Record<string, string> }) => apiFetch('/api/saved-searches', {
      method: 'POST',
      body: JSON.stringify({ name, query, filters }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['saved-searches'] }); },
  });
}

export interface GlossaryTerm {
  term: string;
  synonyms: string[];
  definition?: string | null;
}

export function useGlossary(enabled = true) {
  return useQuery({
    queryKey: ['glossary'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: GlossaryTerm[] }>('/api/glossary');
      return res.data ?? [];
    },
  });
}

export function useSaveGlossary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ term, synonyms, definition }: GlossaryTerm) => apiFetch('/api/admin/glossary', {
      method: 'POST',
      body: JSON.stringify({ term, synonyms, definition }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['glossary'] }); },
  });
}

export interface EvaluationCase {
  id: string;
  title: string;
  question: string;
  expected_sources: string[];
  language?: 'default' | 'en' | 'ja';
}

export interface EvaluationRun {
  id: string;
  case_count: number;
  hit_rate: number;
  mean_reciprocal_rank: number;
  model?: string;
  prompt_version?: string;
  by_language?: Record<string, { case_count: number; hit_rate: number; mean_reciprocal_rank: number }>;
  created_at: string;
}

export function useEvaluations(enabled = true) {
  return useQuery({
    queryKey: ['evaluations'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { cases: EvaluationCase[]; runs: EvaluationRun[] } }>('/api/admin/evaluations');
      return res.data;
    },
  });
}

export function useCreateEvaluationCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, question, expectedSources, language }: { title: string; question: string; expectedSources: string[]; language: 'default' | 'en' | 'ja' }) => apiFetch('/api/admin/evaluations', {
      method: 'POST',
      body: JSON.stringify({ title, question, expected_sources: expectedSources, language }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['evaluations'] }); },
  });
}

export function useRunEvaluations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiFetch('/api/admin/evaluations/run', { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['evaluations'] }); },
  });
}

export interface PersonResult {
  name: string;
  role: string;
  department?: string | null;
  sources: string[];
}

export function usePeopleSearch() {
  return useMutation({
    mutationFn: async (query: string) => {
      const res = await apiFetch<{ success: boolean; data: PersonResult[] }>(`/api/people?q=${encodeURIComponent(query)}`);
      return res.data ?? [];
    },
  });
}

export function useDocuments(enabled = true) {
  return useQuery({
    queryKey: ['documents'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: DocumentsPayload }>('/api/documents');
      return res.data ?? { total_chunks: 0, documents: {}, records: [] };
    },
  });
}

export function useHealth(enabled = true) {
  return useQuery({
    queryKey: ['health'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { status: string; chunks: number; db: boolean } }>(
        '/api/health'
      );
      return res.data;
    },
  });
}

export interface McpTool {
  name: string;
  description: string;
  annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean };
}

export interface McpCapabilities {
  protocol_version: string;
  transport: string;
  authentication: string;
  tools: McpTool[];
  read_only: boolean;
  audit_events: string[];
}

export function useMcpCapabilities(enabled = true) {
  return useQuery({
    queryKey: ['mcp-capabilities'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: McpCapabilities }>('/api/mcp');
      return res.data;
    },
  });
}

export function useMcpToolCheck() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ jsonrpc: string; id: string; result?: { isError?: boolean } }>('/api/mcp', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'admin-check',
          method: 'tools/call',
          params: { name: 'search', arguments: { query: 'staging database', top_k: 1 } },
        }),
      });
      if (res.result?.isError) throw new Error('MCP tool returned an error');
      return res;
    },
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: ChatSession }>('/api/chats', { method: 'POST' });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/chats/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useDeleteAllChats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { deleted: number } }>('/api/chats', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useDeleteUserData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { deleted_chats: number } }>('/api/users/me/data', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: 'DELETE MY DATA' }),
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
      void qc.invalidateQueries({ queryKey: ['saved-searches'] });
      void qc.invalidateQueries({ queryKey: ['action-proposals'] });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, question, mode, language, contextSources }: { chatId: string; question: string; mode?: 'answer' | 'compare' | 'summarize' | 'checklist' | 'research'; language?: 'default' | 'en' | 'ja'; contextSources?: string[] }) => {
      const res = await apiFetch<{ success: boolean; data: ChatSession }>(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ question, top_k: 3, generate: true, mode: mode || 'answer', language: language || 'default', context_sources: contextSources || [] }),
      });
      return res.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
      void qc.invalidateQueries({ queryKey: ['chat', data.id] });
    },
  });
}

export function useFeedback(chatId: string | null) {
  return useMutation({
    mutationFn: async ({ messageId, kind }: { messageId: string; kind: 'helpful' | 'not_helpful' | 'incorrect' | 'missing_source' | 'report_concern' }) => {
      if (!chatId) throw new Error('Chat is not selected');
      return apiFetch(`/api/chats/${chatId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId, kind }),
      });
    },
  });
}

export interface ActionProposal {
  id: string;
  action_type: string;
  idempotency_key?: string | null;
  title: string;
  target?: string | null;
  inputs: Record<string, string>;
  source_ids: string[];
  permission_scope: string;
  expected_side_effects: string[];
  requester?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  execution_status: 'not_executed';
  created_at: string;
  decision_note?: string | null;
}

export function useCreateActionProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: Omit<ActionProposal, 'id' | 'requester' | 'status' | 'execution_status' | 'created_at' | 'decision_note'>) => {
      const res = await apiFetch<{ success: boolean; data: ActionProposal }>('/api/actions/proposals', {
        method: 'POST',
        body: JSON.stringify(proposal),
      });
      return res.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['action-proposals'] }); },
  });
}

export function useActionProposals(enabled = true) {
  return useQuery({
    queryKey: ['action-proposals'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: ActionProposal[] }>('/api/actions/proposals');
      return res.data ?? [];
    },
  });
}

export function useDecideActionProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: 'approved' | 'rejected'; note?: string }) => apiFetch(`/api/admin/actions/proposals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['action-proposals'] }); },
  });
}

export interface WorkflowTemplate {
  id: string;
  title: string;
  action_type: string;
  description: string;
  required_inputs: string[];
}

export function useWorkflows(enabled = true) {
  return useQuery({
    queryKey: ['workflows'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: WorkflowTemplate[] }>('/api/workflows');
      return res.data ?? [];
    },
  });
}

export function useCreateWorkflowProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, inputs, sourceIds, idempotencyKey }: { workflowId: string; inputs: Record<string, string>; sourceIds: string[]; idempotencyKey: string }) => apiFetch('/api/workflows/' + encodeURIComponent(workflowId) + '/proposals', {
      method: 'POST',
      body: JSON.stringify({ inputs, source_ids: sourceIds, idempotency_key: idempotencyKey }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['action-proposals'] }); },
  });
}

export interface SlackSummary {
  channel_id: string;
  thread_ts?: string | null;
  message_count: number;
  summary: string;
  model?: string;
  source_url?: string | null;
}

export interface SlackStatus {
  ready: boolean;
  enabled: boolean;
  socket_mode_enabled?: boolean;
  scopes?: { granted: string[]; required_missing: string[]; optional_missing: string[] };
}

export function useSlackStatus(enabled = true) {
  return useQuery({
    queryKey: ['slack-status'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: SlackStatus }>('/api/slack/status');
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useSlackSummary() {
  return useMutation({
    mutationFn: async ({ channelId, threadTs, limit, language }: { channelId: string; threadTs?: string; limit?: number; language?: 'default' | 'en' | 'ja' }) => {
      const res = await apiFetch<{ success: boolean; data: SlackSummary }>('/api/slack/summary', {
        method: 'POST',
        body: JSON.stringify({ channel_id: channelId, thread_ts: threadTs || undefined, limit: limit ?? 50, language: language ?? 'default' }),
      });
      return res.data;
    },
  });
}

export interface SlackDigest {
  id: string;
  channel_ids: string[];
  destination_channel?: string | null;
  schedule: 'on_demand' | 'hourly' | 'daily';
  last_run_at?: string | null;
  active: boolean;
}

export function useSlackDigests(enabled = true) {
  return useQuery({
    queryKey: ['slack-digests'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: SlackDigest[] }>('/api/slack/digests');
      return res.data ?? [];
    },
  });
}

export function useCreateSlackDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelIds, destinationChannel, schedule, limit, language }: { channelIds: string[]; destinationChannel?: string; schedule: 'on_demand' | 'hourly' | 'daily'; limit?: number; language?: 'default' | 'en' | 'ja' }) => apiFetch('/api/slack/digests', {
      method: 'POST',
      body: JSON.stringify({ channel_ids: channelIds, destination_channel: destinationChannel || undefined, schedule, limit: limit ?? 50, language: language ?? 'default' }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['slack-digests'] }); },
  });
}

export function useRunSlackDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (digestId: string) => apiFetch(`/api/slack/digests/${encodeURIComponent(digestId)}/run`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['slack-digests'] }); },
  });
}

export interface ReviewItem {
  id: string;
  kind: string;
  question: string;
  answer: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  created_at: string;
}

export function useReviews(enabled = true) {
  return useQuery({
    queryKey: ['reviews'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: ReviewItem[] }>('/api/admin/reviews');
      return res.data ?? [];
    },
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReviewItem['status'] }) => apiFetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['reviews'] }); },
  });
}

export function useAnalytics(enabled = true) {
  return useQuery({
    queryKey: ['analytics'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { feedback_total: number; open_reviews: number; review_total: number; feedback_by_kind: Record<string, number>; active_users: number; questions: number; source_accesses: number; source_clicks: number; no_result_queries: number; fallback_answers: number; exports: number; answer_count: number; average_latency_ms: number; p95_latency_ms: number; estimated_usage_cost: number; feedback_rate: number; proposal_count: number; approval_rate: number; completion_rate: number; error_count: number; human_handoffs: number } }>('/api/admin/analytics');
      return res.data;
    },
  });
}

export function useSourceHealth(enabled = true) {
  return useQuery({
    queryKey: ['source-health'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { total: number; draft: number; expired: number; expiring_soon: number; ownerless: number; duplicate: number; connector_failures: number; paused_connectors: number } }>('/api/admin/source-health');
      return res.data;
    },
  });
}

export interface OrganizationBoundary {
  mode: string;
  claim: string;
  configured_organization_id: string;
  enforced: boolean;
}

export interface IdentityProviderPolicy {
  provider_id: string;
  provider_type: string;
  enterprise_sso_configured: boolean;
  scim_configured: boolean;
  scim_endpoint: string;
}

export function usePolicies(enabled = true) {
  return useQuery({
    queryKey: ['policies'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { model_provider: string; no_training: string; provider_retention: string; chat_retention_days: number; retention: RetentionPolicy; source_permissions: string; dlp_action: 'flag' | 'redact' | 'block'; data_residency: string; regional_processing: string; secrets_rotation_days: string; encryption_at_rest: string; data_export: string; deletion_confirmation: string; identity_provider: IdentityProviderPolicy; organization_id: string; organization_boundary: OrganizationBoundary; approved_connector_kinds: string; action_allowlist: string; approved_models: string; web_access: 'disabled' | 'approved_only' | 'enabled'; allowed_data_classes: string; allowed_tools: string; updated_at?: string } }>('/api/admin/policies');
      return res.data;
    },
  });
}

export interface AdminPolicy {
  approved_connector_kinds: string[];
  approved_models: string[];
  web_access: 'disabled' | 'approved_only' | 'enabled';
  allowed_data_classes: string[];
  allowed_tools: string[];
  action_scopes: string[];
}

export function useUpdateAdminPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (policy: AdminPolicy) => {
      const res = await apiFetch<{ success: boolean; data: AdminPolicy }>('/api/admin/policies/access', {
        method: 'PATCH',
        body: JSON.stringify(policy),
      });
      return res.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['policies'] }); },
  });
}

export interface RetentionPolicy {
  chat_days: number;
  source_copy_days: number;
  embedding_days: number;
  audit_event_days: number;
  metrics_days: number;
  feedback_days: number;
  updated_at?: string;
  updated_by?: string | null;
}

export function useUpdateRetentionPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (policy: RetentionPolicy) => {
      const res = await apiFetch<{ success: boolean; data: RetentionPolicy }>('/api/admin/policies/retention', {
        method: 'PATCH',
        body: JSON.stringify(policy),
      });
      return res.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['policies'] }); },
  });
}

export function useApplyRetentionPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { removed: Record<string, number>; policy: RetentionPolicy } }>('/api/admin/policies/retention/apply', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'APPLY RETENTION' }),
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['policies'] });
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateDlpPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: 'flag' | 'redact' | 'block') => {
      const res = await apiFetch<{ success: boolean; data: { dlp_action: string; updated_at: string; updated_by?: string | null } }>('/api/admin/policies/dlp', {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      return res.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['policies'] }); },
  });
}

export interface AuditEntry {
  id: string;
  created_at: string;
  event: string;
  actor?: string | null;
  detail_hash?: string | null;
}

export function useAudit(enabled = true) {
  return useQuery({
    queryKey: ['audit'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: AuditEntry[] }>('/api/admin/audit');
      return res.data ?? [];
    },
  });
}

export interface ConnectorRecord {
  id: string;
  name: string;
  kind: string;
  status: 'active' | 'paused';
  schedule?: string | null;
  config?: { root_path?: string; token_env?: string; scope_id?: string; drive_id?: string; endpoint_url?: string; integration_category?: string };
  last_success_at?: string | null;
  last_error?: string | null;
  failure_count?: number;
  retry_limit?: number;
  retry_backoff_seconds?: number;
  retry_count?: number;
  last_sync_duration_ms?: number | null;
  stale_count?: number;
  indexed_sources?: string[];
  contract?: {
    version: string;
    authentication: { mode: string; server_token_configured: boolean; oauth_status: string; admin_consent: string };
    crawl_scope: { root_path_configured: boolean; scope_id_configured: boolean; drive_id_configured: boolean; selection_status: string; schedule?: string | null };
    source_metadata: string[];
    identities: { directory_mapping: boolean; source_identity_fields: string[] };
    permissions: { query_time_acl: boolean; enforced_at: string[] };
    incremental: { supported: boolean; strategy: string };
    deletion: { supported: boolean; strategy: string; last_removed_count: number; quarantine_on_error: boolean; quarantined_count: number; freshness_target_seconds?: number | null };
    retries: { limit: number; backoff_seconds: number; last_attempt_count: number };
    health: { status?: string | null; last_attempt_at?: string | null; last_success_at?: string | null; last_error?: string | null; failure_count: number; stale_count: number; last_sync_duration_ms?: number | null };
  };
}

export function useConnectors(enabled = true) {
  return useQuery({
    queryKey: ['connectors'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: ConnectorRecord[] }>('/api/admin/connectors');
      return res.data ?? [];
    },
  });
}

export function useCreateConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, kind, rootPath, tokenEnv, scopeId, driveId, endpointUrl, integrationCategory, schedule, retryLimit, retryBackoffSeconds, webhookSecretEnv }: { name: string; kind: 'local_folder' | 'google_drive' | 'sharepoint' | 'rest_api'; rootPath?: string; tokenEnv?: string; scopeId?: string; driveId?: string; endpointUrl?: string; integrationCategory?: string; schedule?: string; retryLimit?: number; retryBackoffSeconds?: number; webhookSecretEnv?: string }) => apiFetch('/api/admin/connectors', {
      method: 'POST',
      body: JSON.stringify({ name, kind, root_path: rootPath || '', token_env: tokenEnv || undefined, scope_id: scopeId || undefined, drive_id: driveId || undefined, endpoint_url: endpointUrl || undefined, integration_category: integrationCategory || undefined, schedule: schedule || undefined, retry_limit: retryLimit ?? 3, retry_backoff_seconds: retryBackoffSeconds ?? 5, webhook_secret_env: webhookSecretEnv || undefined }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['connectors'] }); },
  });
}

export function useSyncConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiFetch(`/api/admin/connectors/${id}/sync`, { method: 'POST' }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['connectors'] });
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, retryLimit, retryBackoffSeconds }: { id: string; status?: 'active' | 'paused'; retryLimit?: number; retryBackoffSeconds?: number }) => apiFetch(`/api/admin/connectors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, retry_limit: retryLimit, retry_backoff_seconds: retryBackoffSeconds }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['connectors'] }); },
  });
}

export interface BackupRecord {
  filename: string;
  created_at: string;
  verified_at: string;
  format: string;
  size_bytes: number;
}

export interface BackupStatus {
  configured: boolean;
  retention_count: string;
  records: BackupRecord[];
}

export function useBackups(enabled = true) {
  return useQuery({
    queryKey: ['backups'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: BackupStatus }>('/api/admin/backups');
      return res.data;
    },
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: BackupRecord }>('/api/admin/backups', { method: 'POST' });
      return res.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['backups'] }); },
  });
}

export interface DirectoryUser {
  external_id: string;
  email: string;
  display_name?: string | null;
  groups: string[];
  roles: string[];
  active: boolean;
  source: string;
}

export function useDirectoryUsers(enabled = true) {
  return useQuery({
    queryKey: ['directory-users'],
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: DirectoryUser[] }>('/api/admin/directory/users');
      return res.data ?? [];
    },
  });
}

export function useUpsertDirectoryUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: { externalId: string; email: string; displayName?: string; groups: string[]; roles: string[]; active: boolean }) => apiFetch('/api/admin/directory/users', {
      method: 'POST',
      body: JSON.stringify({ external_id: record.externalId, email: record.email, display_name: record.displayName || undefined, groups: record.groups, roles: record.roles, active: record.active, source: 'admin' }),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['directory-users'] }); },
  });
}

export function useDeleteDirectoryUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (externalId: string) => apiFetch(`/api/admin/directory/users/${encodeURIComponent(externalId)}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['directory-users'] }); },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch<{ success: boolean }>(
        '/api/documents/ingest',
        { method: 'POST', body: formData }
      );
      return res;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiFetch(`/api/documents/${encodeURIComponent(name)}`, { method: 'DELETE' });
      return name;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateDocumentMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, title, status, owner, subject_matter_expert, allowed_emails, allowed_domains, allowed_groups, source_system, topic, department, source_url, last_reviewed_at, effective_date, expiration_date, data_classification }: { name: string; title?: string; status: string; owner?: string; subject_matter_expert?: string; allowed_emails?: string; allowed_domains?: string; allowed_groups?: string; source_system?: string; topic?: string; department?: string; source_url?: string; last_reviewed_at?: string; effective_date?: string; expiration_date?: string; data_classification?: 'internal' | 'personal' | 'restricted' }) => apiFetch(`/api/documents/${encodeURIComponent(name)}/metadata`, {
      method: 'PATCH',
      body: JSON.stringify({ title: title || undefined, status, owner: owner || undefined, subject_matter_expert: subject_matter_expert || undefined, allowed_emails: allowed_emails ? allowed_emails.split(',').map((email) => email.trim()).filter(Boolean) : [], allowed_domains: allowed_domains ? allowed_domains.split(',').map((domain) => domain.trim().replace(/^@/, '')).filter(Boolean) : [], allowed_groups: allowed_groups ? allowed_groups.split(',').map((group) => group.trim()).filter(Boolean) : [], source_system: source_system || undefined, topic: topic || undefined, department: department || undefined, source_url: source_url || undefined, last_reviewed_at: last_reviewed_at || undefined, effective_date: effective_date || undefined, expiration_date: expiration_date || undefined, data_classification: data_classification || undefined }),
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

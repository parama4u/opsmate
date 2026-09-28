# OrgChai Product Requirements Document

Status: Working PRD
Product in repository: OpsMate, legacy implementation name pending rebrand
Public product name: OrgChai.com
Public domain: `orgchai.com`
Last updated: 2026-09-26

## 1. Product Summary

OrgChai is a privacy-focused chat app for everything about an organization. It starts as an internal knowledge assistant for small and midsize organizations: employees ask questions in natural language and receive concise answers grounded in approved company documents, with visible sources they can verify. The product is available in a web workspace and Slack.

The product should earn trust before it expands scope. A useful answer must be easy to verify, limited to information the user can access, and clear when the knowledge base does not contain an answer.

### Brand and launch identity

- Display brand: `OrgChai.com`.
- Product descriptor: "A privacy-focused chat app for everything about your organization."
- Canonical domain: `https://orgchai.com`.
- Brand voice: plain, specific, privacy-conscious, and useful. Avoid presenting OrgChai as an unrestricted generic AI assistant.
- Rebrand scope includes the web UI, API metadata, SEO, translated copy, Slack-facing copy, package descriptions, environment examples, internal folders, module namespaces, and deployment configuration.
- Until the rebrand work is implemented, `OpsMate` remains the legacy name in the repository and runtime code.

## 2. Target Users and Jobs

### Employees

- Find HR policies, IT runbooks, security guidance, and operating procedures without knowing the file name or owner.
- Ask follow-up questions in the tool where work already happens.
- Verify the source before acting on an answer.

### Knowledge administrators

- Publish and remove approved source material.
- Keep answers aligned with current policy.
- Understand what people are asking and where the knowledge base is weak.

### Product principles

- Ground answers in organization-controlled sources.
- Show evidence, not just a confident response.
- Enforce access at retrieval time.
- Start with a small, understandable operating surface.
- Improve from real questions, feedback, and content quality signals.

## 3. Current Implementation Checklist

The following capabilities are present in the repository today.

### Web experience

- [x] Marketing page describing internal Q&A, source-backed answers, web and Slack access, and security boundaries.
- [x] Authenticated dashboard with navigation for chat, settings, and admin users.
- [x] English and Japanese UI strings through `next-intl`.
- [x] Responsive chat workspace with collapsible sidebar.
- [x] Suggested starter questions for an empty chat.
- [x] Markdown and GitHub-flavored Markdown rendering for assistant responses.
- [x] Source list rendered below assistant responses, including source name and relevance score when available.
- [x] Loading, error, empty, and sign-in-required states.
- [x] Settings view showing the signed-in user's profile and admin state.

### Authentication and application security

- [x] Firebase client authentication with Google sign-in.
- [x] Firebase ID token verification on protected API routes.
- [x] Server-side API proxy that injects `APP_API_KEY` without placing it in the browser bundle.
- [x] Per-user chat ownership checks on read, write, rename, and delete operations.
- [x] Admin access controlled by configured email addresses.
- [x] API rate limiting and configurable CORS origin.
- [x] Filename normalization checks for document reads and writes.

### Knowledge base and retrieval

- [x] Admin-only document upload for UTF-8 `.txt` files.
- [x] Admin-only document deletion and full index clearing.
- [x] Document listing with indexed chunk counts.
- [x] Document content retrieval by filename.
- [x] Paragraph and sentence-based chunking.
- [x] In-memory TF-IDF retrieval fallback.
- [x] PostgreSQL plus pgvector retrieval path with sentence embeddings when configured.
- [x] Seed document loading at API startup.
- [x] Shared organization knowledge base used by web and Slack.

### Answers and conversations

- [x] Direct `/api/ask` question endpoint.
- [x] Persistent chat sessions and messages.
- [x] Chat creation, listing, loading, renaming, and deletion.
- [x] Automatic first-question chat title.
- [x] Retrieval-only mode for showing the most relevant snippets without generation.
- [x] Optional OpenAI-compatible answer generation with extractive fallback when the model is unavailable.
- [x] Source metadata persisted with assistant messages.

### Slack

- [x] Answers to bot mentions in channels.
- [x] Answers to direct messages.
- [x] `/opsmate` slash command support when the optional scope is configured.
- [x] Threaded Slack replies.
- [x] Source names and relevance scores included in Slack answers.
- [x] Socket Mode support and HTTP events endpoint support.
- [x] Slack configuration, connection, and scope status endpoint.

### Operations and platform foundation

- [x] FastAPI service with structured `{ success, data, error }` responses.
- [x] PostgreSQL schema and migration for users, chats, messages, and document chunks.
- [x] File-backed chat persistence fallback when `DATABASE_URL` is absent.
- [x] Health endpoint reporting API, database, and indexed chunk status.
- [x] Docker Compose configuration for the local PostgreSQL and application setup.
- [x] SEO metadata, sitemap, and robots configuration for the web app.

## 4. Current Product Boundaries

These are important product facts, not failure conditions:

- The current upload workflow supports `.txt` only.
- The knowledge base is shared across the organization. There is no document-level or source-level permission model.
- Chat history is scoped to the signed-in user, but assistant retrieval does not yet use earlier turns as conversation context.
- Sources currently identify indexed filenames and snippets. They are not linked back to a canonical document location.
- There is no end-user answer feedback, quality review queue, usage analytics, or audit trail for knowledge changes.
- Slack currently answers questions against the shared document index. It does not index Slack history as a knowledge source.
- There are no source connectors, scheduled syncs, webhooks, or incremental re-indexing workflows.
- There is no action execution layer for creating tickets, updating systems, or triggering workflows.

## 5. Deep Market Research

Research date: 2026-09-26. This review covered first-party product pages and documentation for Slack AI, Glean, Guru, Atlassian Rovo, Notion AI Enterprise Search, Microsoft 365 Copilot, Google Gemini Enterprise, Slite, Sana, and Coveo. Vendor capability claims are directional signals, not independent quality benchmarks.

### Category expectations

1. Cited answers are table stakes. Slack AI, Notion AI, Microsoft Copilot, Rovo, Glean, Guru, Slite, and Coveo all make source traceability a core part of the answer experience. A filename-only citation is now a weak baseline; users expect a source preview or a link to the original item.

2. The product category is becoming unified search, not a standalone RAG chat. The leading products search documents, messages, tickets, files, databases, and people across multiple systems. Customers increasingly expect the assistant to work over the systems they already use.

3. Permission enforcement must happen at retrieval time. Glean, Microsoft Copilot, Notion, Google Gemini Enterprise, Sana, Slite, and Coveo all describe answers constrained by source permissions. Importing content into a shared corpus without identity mapping is a serious deployment blocker beyond a curated pilot.

4. Connectors are an operating system capability. Mature products expose connector administration, OAuth or admin consent, scope controls, crawl status, refresh behavior, source deletion, retries, and connector-specific permission handling. A connector that works once but cannot show whether it is current is not operationally trustworthy.

5. Knowledge quality is managed, not assumed. Guru and Slite emphasize verified content. Glean emphasizes authoritative and current results, people expertise, and quality feedback. Expected controls include owners, review dates, expiration, canonical sources, stale-content warnings, duplicates, and a path for employees to report a problem.

6. Search is personalized by people and context. Glean and Coveo surface experts, teams, related content, and behavior-based relevance. Notion supports adding pages or people as context and narrowing the source scope. OrgChai should eventually understand departments, owners, acronyms, and source collections.

7. Multi-turn and research workflows are becoming normal. Sana, Coveo, Glean, Notion, and Gemini Enterprise support follow-up questions, deeper research, summarization, comparison, or report creation. OrgChai currently persists chats but does not pass previous turns into retrieval or generation.

8. The answer surface is expanding into the work surface. Slack supports summaries, recaps, sharing, and file summaries. Slite offers browser and Slack entry points, scheduled digests, and workflow-oriented retrieval. Rovo embeds search in Atlassian workflows. A dashboard-only experience will have a discoverability ceiling.

9. Admins need proof of value and control. Glean and Coveo expose adoption, engagement, feedback, search activity, clicks, content gaps, and model usage. Notion exposes audit and content governance controls. OrgChai needs operational and quality analytics before it adds many connectors or actions.

10. Agent actions are arriving behind governance controls. Glean, Gemini Enterprise, Slite, and Microsoft ecosystems combine search with agents or tools. The common safety pattern is least-privilege access, admin allowlists, human approval, previews, and audit trails. Write actions should follow, not precede, permission and audit foundations.

11. Enterprise buyers evaluate data handling as part of the product. Notion and Sana describe zero-retention or no-training policies for model providers. Common expectations include encryption, provider controls, retention and deletion behavior, audit logs, SSO, role-based administration, and clear separation between customer data and model training.

### Competitive capability matrix

| Product | Strong current capability | Missing or underdeveloped in OrgChai |
| --- | --- | --- |
| Slack AI | In-context answers, citations, channel and thread summaries, recaps, file summaries, and enterprise search | Rich Slack-native workflows, source links, recaps, and Slack history as a governed source |
| Glean | Broad connectors, permission mirroring, knowledge graph, people and expert discovery, browser and Slack surfaces, actions, and quality analytics | Connectors, identity mapping, personalized ranking, expert discovery, browser entry point, actions, and analytics |
| Guru | Cited and permission-aware answers, verified knowledge, ownership, expiration, lineage, audit logs, research mode, and feedback-driven quality | Verification lifecycle, content ownership, expiration, lineage, audit, research mode, and knowledge quality signals |
| Atlassian Rovo | Cross-tool answers, citations, intent-aware search, rich result cards, and workflow embedding | Search filters, rich structured result blocks, intent routing, and embedded workflow context |
| Notion AI Enterprise Search | Search across workspace and connected apps, citations, @mentions for pages and people, source scoping, database-aware search, and model choice | Search scope controls, contextual mentions, structured data search, model controls, and connector permissions |
| Microsoft 365 Copilot | External connectors, citations, admin connector controls, source permissions, and search alongside Microsoft 365 content | Connector catalog and controls, external identity mapping, source filters, and enterprise admin policy surface |
| Google Gemini Enterprise | Multimodal enterprise search, prebuilt connectors, conversational assistance, custom agents, personalization, mobile access, and access-controlled answers | Multimodal ingestion, agent workspace, mobile access, personalization, and broad connector coverage |
| Slite | Unified retrieval across docs, threads, tickets, tables, and dashboards; browser extension; Slack answers; scheduled digests; MCP; provenance; verification | Structured and multimodal retrieval, browser surface, scheduled digests, verification, orchestration traces, and MCP access |
| Sana | Search assistant with follow-up conversation, context-specific asking, user-authorized content, and explicit no-training posture | Follow-up context, source-specific asking, privacy controls, and learning or onboarding use cases |
| Coveo | Relevance and generative answering, item-level permissions, conversational search, smart snippets, people recommendations, OCR, connectors, and analytics | Query-time ACLs, conversational search, OCR, recommendations, content gap analytics, and richer relevance controls |

### Missing feature groups surfaced by research

| Gap | Why it matters | Priority |
| --- | --- | --- |
| Source links, previews, and provenance | Users need to verify the exact evidence, not only a filename | P0 |
| Conversation context and research mode | Single-turn retrieval is insufficient for follow-up, comparison, and multi-document questions | P0 |
| Verification, owners, review dates, and expiration | Approved knowledge must stay current and accountable | P0 |
| Connector health and freshness | Admins need to know whether answers reflect current source data | P0 |
| Identity mapping and query-time source ACLs | Shared retrieval becomes unsafe as soon as private or mixed-scope content is connected | P0 |
| Feedback, analytics, and content-gap reporting | Product quality cannot improve without evidence of failure and adoption | P0 |
| File and content breadth, including OCR and tables | `.txt`-only ingestion is below current enterprise search expectations | P1 |
| Search scope, filters, people, experts, and organizational vocabulary | Users need ways to narrow ambiguous workplace questions | P1 |
| Browser, Slack, digest, and workflow surfaces | Answers must appear where questions originate | P1 |
| Audit, retention, provider, and admin policy controls | Security and procurement require visible data-handling controls | P1 |
| Governed tool use and write actions | Search products are moving toward task completion, but only with approvals and audit | P2 |

### Positioning opportunity

OrgChai should not compete initially on connector count or general-purpose agent breadth. A credible wedge is:

> A focused, self-controlled knowledge assistant for teams that need reliable answers from a small set of approved sources, without deploying a large enterprise search platform.

The product can win an initial segment by being simpler to operate, explicit about evidence, easy to deploy, and opinionated about trusted internal content. That positioning only remains credible if source freshness, permissions, answer quality, and data handling become first-class product capabilities as the corpus grows.

### Market sources

- [Slack: Guide to AI features](https://api.slack.com/help/articles/25076892548883-Guide-to-AI-features)
- [Slack: Enterprise Search](https://app.slack.com/features/enterprise-search)
- [Glean: About connectors](https://docs.glean.com/connectors/about)
- [Glean: What is Glean?](https://docs.glean.com/user-guide/about/what-is-glean)
- [Glean: Assistant insights](https://docs.glean.com/administration/insights/assistant-insights)
- [Guru: AI enterprise search](https://www.getguru.com/solutions/ai-enterprise-search)
- [Atlassian: Rovo Search improvements](https://www.atlassian.com/blog/rovo/rovo-search-improvements)
- [Notion: Enterprise Search](https://www.notion.com/help/enterprise-search)
- [Notion: Enterprise Search security and privacy](https://www.notion.com/help/enterprise-search-security-and-privacy-practices)
- [Microsoft: Understand Copilot connectors](https://support.microsoft.com/en-us/microsoft-365-copilot/understand-copilot-connectors)
- [Google Cloud: Gemini Enterprise](https://docs.cloud.google.com/gemini/enterprise/docs)
- [Slite: AI search and retrieval](https://slite.com/ai-search)
- [Sana: Search and Assistant](https://help.sana.ai/en/articles/96130-sana-search-a-beginners-guide)
- [Coveo: Solutions and integrations](https://docs.coveo.com/en/1495)

## 6. Roadmap

The roadmap is intentionally separate from the implemented checklist. Priorities are ordered by user trust and security risk, then by expansion potential.

### Phase 0: OrgChai rebrand and launch foundation

- [x] P0: Replace the legacy `OpsMate` product name with `OrgChai` or `OrgChai.com` in user-facing UI, API metadata, SEO, translated messages, Slack responses, and product copy.
- [x] P0: Set `orgchai.com` as the canonical app and marketing domain, including public URL configuration, metadata, sitemap, robots rules, Firebase authorized domains, CORS origin, and callback or redirect settings.
- [x] P0: Rename internal folders, Python package or module namespaces, test and documentation references, Docker labels, and environment defaults from `opsmate` to `orgchai` where the rename is safe and intentional.
- [x] P0: Update the Slack app-facing name, mention guidance, response copy, and setup references to OrgChai.
- [x] P0: Define a migration and rollback plan for legacy `OpsMate` identifiers so existing local data, environment variables, and deployments are not broken unexpectedly.
- [x] P0: Deploy OrgChai to Railway using the existing Docker-based application architecture.
- [x] P0: Configure Railway services, environment variables, secrets, health checks, logs, and deployment branches for the web and API services.
- [x] P0: Provision a production PostgreSQL service with pgvector support, backups, and a documented migration process for the API data model.
- [x] P0: Configure persistent or external storage for uploaded source documents and embeddings so a container restart cannot silently remove the knowledge base.
- [x] P0: Attach `orgchai.com` to the Railway deployment with TLS, production redirects, and a smoke-checkable health endpoint.
- [x] P1: Add a launch checklist covering domain verification, Firebase configuration, Slack configuration, API key rotation, admin access, error monitoring, backups, and rollback.

Success signals:

- A new visitor sees only OrgChai branding and reaches the production app at `orgchai.com`.
- No user-facing surface or deployment artifact unexpectedly exposes the legacy OpsMate name.
- Railway can redeploy the Docker services without losing production data or indexed documents.

### Phase 1: Trustworthy answers and knowledge quality

- [x] P0: Add answer feedback: helpful, not helpful, incorrect, missing source, and report concern.
- [x] P0: Add an admin review queue for low-confidence, unanswered, conflicting, and negatively rated questions.
- [x] P0: Add explicit abstention behavior when evidence is weak, conflicting, unauthorized, or stale.
- [x] P0: Make citations actionable with canonical links, source previews, highlighted passages, and retrieval provenance.
- [x] P0: Preserve conversation context for follow-up questions while re-checking permissions on every turn.
- [x] P0: Add source verification state: draft, approved, verified, expired, archived, and superseded.
- [x] P0: Add source owner, subject-matter expert, last reviewed date, effective date, expiration date, and change history.
- [x] P0: Add canonical-source pinning and duplicate or stale-content detection.
- [x] P1: Add compare, summarize, extract steps, and answer-with-a-checklist modes for multi-document questions.
- [x] P1: Add a research mode that plans a multi-source query, shows progress, and produces a cited report.
- [x] P1: Make document ingest idempotent for the same source instead of allowing duplicate indexed copies.

Success signals:

- Users can verify an answer in one step and identify the exact supporting passage.
- Admins can assign ownership and review status to every authoritative source.
- No-result, low-confidence, and stale-content responses are understandable instead of merely empty.

### Phase 2: Connector platform and permission-aware retrieval

- [x] P0: Support PDF, DOCX, Markdown, HTML, common office formats, attachments, tables, images, and OCR where practical.
- [x] P0: Define a connector contract covering authentication, crawl scope, source metadata, identities, permissions, incremental updates, deletion, retries, and health status.
- [x] P0: Add the first production connector, preferably Google Drive or SharePoint based on the target customer profile.
- [x] P0: Add connector setup with admin consent, OAuth status, selected folders or spaces, sync schedule, last successful crawl, and error details.
- [x] P0: Map source users, groups, and roles to OrgChai identities.
- [x] P0: Enforce source ACLs at query time before retrieval, answer generation, citations, and source previews.
- [x] P0: Remove or quarantine deleted and unauthorized content within a documented freshness target.
- [x] P1: Add source metadata and filters for department, topic, owner, effective date, source system, and document status.
- [x] P1: Add scheduled re-indexing, incremental sync, webhook support, retry controls, and connector pause or resume.
- [x] P1: Improve retrieval with hybrid keyword plus vector search, reranking, duplicate suppression, query rewriting, synonyms, and organization-specific terminology.
- [x] P1: Add tenant and organization boundaries if the product will serve multiple organizations.

Success signals:

- The assistant searches the systems where customers already keep policy and operating content.
- A user never receives a source they could not open in the source system.
- Admins can see whether each source is current, healthy, scoped correctly, and permission-safe.

### Phase 3: Search, discovery, and work surfaces

- [x] P1: Add unified search with source selectors, date and time filters, department or team filters, and known-item lookup.
- [x] P1: Allow users to add context by selecting or mentioning a document, folder, channel, project, team, or person.
- [x] P1: Add people and expert discovery: source owner, subject-matter expert, related team, and suggested next contact.
- [x] P1: Add collections, authoritative source boosts, pinned results, saved searches, and organization glossary or synonym management.
- [x] P1: Add Slack answer sharing with source links and a controlled response format.
- [x] P1: Add Slack thread and channel summarization over explicitly permitted content.
- [x] P1: Add daily or on-demand recaps and scheduled digests for selected channels, collections, or topics.
- [x] P1: Add browser search or extension entry points that can use the current page as context.
- [x] P1: Add richer answer blocks for procedures, checklists, owners, dates, related sources, and structured fields.
- [x] P1: Add Japanese and English answer-language controls and multilingual retrieval evaluation.
- [ ] P2: Add mobile access for search, recaps, and source verification if usage evidence supports it.

Success signals:

- Users can ask from the point of work and reach a cited answer without switching tools.
- Users can find the right person or authoritative source when no single document answers the question.
- Summaries and digests remain traceable to the underlying messages or documents.

### Phase 4: Governance, security, and admin intelligence

- [x] P0: Add role-based administration for knowledge owners, connector administrators, reviewers, analysts, and auditors.
- [x] P0: Add an audit log for sign-ins, searches, source access, connector changes, permission decisions, feedback, exports, and action execution.
- [x] P0: Add configurable retention and deletion policies for chats, prompts, answers, source copies, embeddings, and audit events.
- [x] P0: Document model-provider controls: no training on customer data, retention behavior, regional processing, and approved providers.
- [x] P1: Add SSO and SCIM or equivalent directory provisioning for organizations that need centralized identity management.
- [x] P1: Add encryption, secrets rotation, data export, deletion confirmation, and data residency controls where required by the target segment.
- [x] P1: Add PII and sensitive-data detection, redaction, source classification, and configurable DLP policies.
- [x] P1: Add admin analytics for active users, questions, feedback rate, answer quality, source clicks, no-result queries, content gaps, latency, model fallback, and usage cost.
- [x] P1: Add source and connector health dashboards with sync latency, failures, permission drift, and stale-content counts.
- [x] P1: Add exports for analytics and audit events with appropriate access controls.
- [x] P1: Add an evaluation workspace with golden questions, expected sources, answer quality review, retrieval metrics, and model or prompt version comparison.
- [x] P2: Add admin policies for approved connectors, model choices, web access, data classes, tools, and action scopes.

Success signals:

- An administrator can explain what data the system can access, why a user saw a result, and what the model provider retained.
- Product quality can be improved from measured evidence rather than anecdotal reports.
- Security, privacy, and procurement questions have product-visible answers.

### Phase 5: Governed actions and workflow assistance

- [x] P2: Add read-only integrations for ticketing, HR, project tracking, calendars, and directories.
- [x] P2: Add draft outputs for updates, incident summaries, onboarding plans, policy acknowledgements, and support replies.
- [x] P2: Add action proposals with a preview of inputs, sources, permissions, expected side effects, and target records.
- [x] P2: Require human approval for writes, with an audit record of the requester, approver, tool, inputs, and result.
- [x] P2: Enforce least privilege, action allowlists, rate limits, idempotency, and reversible operations where possible.
- [x] P2: Add reusable workflows for common requests such as IT access, onboarding, incident escalation, and policy acknowledgements.
- [x] P2: Add an MCP or equivalent tool interface only after permission, retention, and audit foundations are in place.
- [x] P2: Add workflow and agent analytics for completion rate, approval rate, errors, and human handoffs.

Success signals:

- The assistant reduces work after answering, rather than only reducing search time.
- Every write is reviewable, attributable, permission-checked, and reversible where possible.
- Users can tell whether the assistant answered, drafted, proposed, or completed an action.

## 7. Non-Goals for the Next Release

- General-purpose autonomous agents with unrestricted write access.
- Replacing Slack, document management, ticketing, or HR systems.
- Indexing every organization source before the first customer workflow is reliable.
- Building a large admin suite before feedback, source quality, and permission safety are measurable.

## 8. Release Gate for the Next Milestone

The next release should be considered ready when an admin can publish approved content with an owner and review status, a user can ask a multi-turn question, the answer includes a deep link and supporting passage, a user cannot retrieve unauthorized content, stale or weak evidence produces an explicit abstention, and the admin can see and act on low-quality or unanswered questions.

Automated tests are intentionally out of scope for this PRD update, per request. Validation of future implementation should be added alongside the relevant feature work.

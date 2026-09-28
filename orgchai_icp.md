# OrgChai ICP

Research date: 2026-09-26  
Product reviewed: OpsMate, the current product implementation behind the OrgChai working name and planned OrgChai.com rebrand  
Workspace: `/Users/paramp/ws/opsmate`

Evidence base: `README.md`, `orgchai_prd.md`, the current `web/` and `api/` implementation, the English and Japanese product copy, and the sample HR and IT documents.

## Executive answer

The best initial ICP is a 50 to 150 employee, Slack-first B2B software, digital services, or professional-services company with a lean People Ops function and a visible employee self-service problem. The first use case should be HR policy and onboarding Q&A, with IT self-service as the second use case.

The buying account has a Head of People, People Ops lead, COO, or founder who can name repeated questions from the last seven days, owns or can assemble the handbook and policy documents, and can approve a two-week pilot without enterprise procurement. The initial rollout should cover 30 to 100 employees and 20 to 80 approved documents.

The clearest positioning is:

> OrgChai gives lean People Ops teams a source-backed employee self-service assistant for handbook, policy, and onboarding questions in Slack and on the web.

Do not position the current product as enterprise search, a general-purpose AI coworker, or a replacement for a full knowledge-management system. The current implementation is strongest as a lightweight internal Q&A layer for a small company with a controlled document set.

This is consistent with the working PRD, which defines OrgChai for small and midsize organizations and prioritizes trusted answers, visible evidence, access control, and a small operating surface before broader integrations or actions.

The tighter ICP is a go-to-market hypothesis, not a claim that every 50 to 150 employee company is qualified. Buying intent should be proven by a live operational trigger and repeated questions, not by headcount alone.

## Product audit

### Implemented capabilities

- Web chat with persistent, user-scoped conversations.
- Retrieval over an indexed internal document collection, with source names and relevance scores shown with answers.
- Admin-only upload and deletion of UTF-8 `.txt` documents.
- PostgreSQL storage with pgvector when configured, plus an in-memory TF-IDF fallback.
- Optional generated answers through an OpenAI-compatible API, with an extractive fallback when the model is unavailable.
- Slack access through app mentions, direct messages, and `/orgchai`.
- Google sign-in through Firebase, server-side API-key injection, rate limiting, and admin email configuration.
- English and Japanese web copy.
- Admin view showing indexed chunks, document count, and database health.

### Product shape that matters for ICP

- The knowledge base is shared across the deployment. Chat history is scoped per user, but document-level permissions are not implemented.
- The current ingest path accepts `.txt` only. There are no native connectors for Google Drive, Notion, Confluence, SharePoint, Jira, or Slack history.
- Slack answers use the same shared document index as the web app. They do not yet retrieve prior Slack conversations.
- Document freshness, approvals, version history, answer feedback, usage analytics, and ownership workflows are not implemented.
- Authentication is Google/Firebase-based. The code does not yet provide enterprise SSO, SCIM, granular roles, or tenant administration.

These constraints make a focused small-company segment more credible than a regulated enterprise segment at launch.

## Primary ICP

### Firmographic profile

- 50 to 150 employees, with 50 to 100 as the preferred starting band.
- B2B software, digital agency, consultancy, or professional-services company.
- Slack is the daily employee communication layer, with active channels such as `#ask-hr`, `#people-ops`, `#help-it`, `#onboarding`, or equivalent.
- People Ops is handled by one to three people, often alongside office or operations work. IT is lean or partly outsourced.
- The company has an employee handbook, benefits or leave policy, onboarding guide, security guide, and operating procedures, but no reliable question-answering layer.
- Google Workspace, Notion, Confluence, or shared drives are common sources. The current product requires a curated export to `.txt` for the pilot.
- Initial geography: United States, Canada, United Kingdom, Australia, and Japan-based companies with English or mixed English/Japanese documentation.

### Narrowest beachhead

The first campaign should target 50 to 150 employee B2B SaaS companies that have hired recently, operate hybrid or distributed teams, and have a People Ops manager who is still answering handbook questions manually. This is narrower and more actionable than targeting all companies with an internal knowledge problem.

### Best-fit company types

1. B2B software companies with 50 to 150 employees and active hiring.
2. Digital agencies, consultancies, and professional-services firms with 50 to 150 employees and repeatable delivery procedures.
3. Venture-backed startups where founders, People Ops, or IT are becoming an internal help desk.
4. Multi-location services companies with recurring HR, safety, scheduling, or operating questions, only when Slack is the daily work surface.
5. Japan-based companies with mixed Japanese and English documentation, if the product can reliably support both languages in the actual answer flow.

### Pain profile

The company is a strong prospect when several of these are true:

- The same questions appear repeatedly in Slack: leave, expenses, onboarding, access, security, incident escalation, or basic IT setup.
- Employees do not know which document is authoritative.
- New hires ask for help finding information that already exists.
- People Ops, IT, or Operations spends several hours each week answering or redirecting internal questions.
- Documentation exists but is scattered, stale, hard to search, or written for the author rather than the employee.
- The company wants answers to show the source instead of asking employees to trust an ungrounded chatbot.
- The buyer wants a pilot that can be configured by one administrator without a long systems-integration project.

## Buying-intent signals

Treat an account as sales-ready only when at least two firmographic signals and two active buying signals are present.

### Strong signals

- A People Ops or HR leader publicly mentions repeated questions about PTO, benefits, onboarding, expenses, remote work, or policy changes.
- The company is hiring across multiple functions, opening a new office, entering a new country, or moving to hybrid work.
- A new Head of People, People Operations Manager, Office Manager, or IT Manager has joined within the last six months.
- The company is rewriting its handbook, launching an employee self-service initiative, or replacing an intranet, wiki, or HR helpdesk process.
- Job posts mention employee experience, HRIS, internal support, onboarding, knowledge management, or IT helpdesk ownership.
- The buyer can provide 20 or more approved documents and identify a single content owner.
- The buyer agrees that the first success metric is fewer repeated questions or faster answers, not autonomous action execution.

### Search-intent signals

Use these for SEO, paid search, and prospect research, in this order:

1. Employee self-service, employee handbook, handbook questions, onboarding knowledge base, and HR policy questions.
2. HR helpdesk, internal IT helpdesk, IT self-service, and employee onboarding software.
3. HR chatbot, AI HR assistant, internal knowledge base, and enterprise search.

The first group is closer to the buyer's problem language. The third group is useful for comparison shoppers, but is lower-volume or more crowded and should not be the only acquisition strategy.

### Weak signals

- A company has Slack but no visible employee support pain.
- A founder says they are “interested in AI” without naming a repeated workflow.
- The prospect wants a broad search product across CRM, tickets, email, source code, and Slack history.
- The prospect cannot identify an administrator or an approved source set.

## Personas and buying committee

| Role | Job in the purchase | Message that should resonate |
| --- | --- | --- |
| COO, founder, or Head of Operations | Economic buyer | Reduce repeated internal questions without adding another full operating system. |
| Head of People or People Ops manager | Primary champion | Give employees a clear answer on policies and onboarding, with the source attached. |
| IT or internal systems manager | Technical champion or approver | Deflect routine access and troubleshooting questions while keeping the approved guide in control. |
| Office or operations manager | Daily administrator | Upload the small set of trusted guides and see what the team asks. |
| Employees and new hires | End users | Ask naturally in the web app or Slack instead of searching filenames or interrupting a colleague. |

The first sale should have one accountable content owner. If nobody owns the source documents, the product will be blamed for stale answers even when retrieval works correctly.

## Highest-value use cases

Start with one or two workflows, not a company-wide AI rollout.

1. Employee self-service: leave, benefits, expenses, remote work, travel, and handbook questions.
2. New-hire ramp: onboarding steps, account setup, team norms, and the first-week questions that otherwise reach People Ops.
3. IT self-service: password reset, device setup, access requests, security reporting, and routine troubleshooting.
4. Operations runbooks: escalation paths, incident response, approvals, recurring procedures, and handoffs.

The best first question is specific, frequent, and answerable from one or a few authoritative documents. Avoid questions that require live system data, personal employee records, or multi-step actions.

## Trigger events

Prioritize prospects experiencing one of these events:

- Hiring has accelerated and onboarding questions are consuming senior staff time.
- A People Ops or IT generalist is supporting a larger team without a corresponding increase in headcount.
- The company is moving from one office to hybrid or distributed work.
- A founder or functional leader says, “I answer this every week.”
- The company has just consolidated or rewritten its handbook, security guide, or runbooks.
- A merger, office opening, or international expansion has created duplicated or conflicting procedures.
- The company is considering Glean, Guru, Slite, Confluence, or enterprise search but wants a smaller pilot first.
- A People Ops or HRIS owner has been asked to reduce employee questions without adding headcount.
- A handbook or benefits refresh is creating a temporary spike in “what changed?” questions.
- The company has an active employee self-service, intranet, HRIS, or internal helpdesk project.

## Poor-fit segments for the current product

- Companies below roughly 20 employees, where informal communication is still faster than maintaining a knowledge base.
- Companies above roughly 500 employees that require SSO, SCIM, granular permissions, audit logs, legal review, and many connectors before a pilot.
- Highly regulated teams that need document-level access control or strict data residency guarantees.
- Microsoft 365-first organizations that do not use Slack.
- Teams whose main problem is customer-facing documentation rather than employee knowledge.
- Companies whose valuable knowledge lives primarily in Slack history, tickets, CRM records, or live databases.
- Prospects expecting the assistant to take actions, open tickets, update systems, or answer from private employee data.
- Companies shopping specifically for a full HRIS, payroll, benefits, or case-management platform.

## Market and competitor research

### Google Search Trends signals

Google Trends was checked for United States web search, past five years, on 2026-09-26. Google Trends is normalized relative interest, not keyword volume, and a low score can mean low data rather than zero searches.

- [Employee handbook vs HR knowledge base vs HR chatbot](https://trends.google.com/trends/explore?geo=US&date=today%205-y&q=employee%20handbook,HR%20knowledge%20base,HR%20chatbot): average interest was 70, 0, and 1 respectively. “Employee handbook” is the much stronger problem-language entry point.
- [IT help desk vs internal IT support vs employee self service](https://trends.google.com/trends/explore?geo=US&date=today%205-y&q=IT%20help%20desk,internal%20IT%20support,employee%20self%20service): average interest was 53, 11, and 38. “IT help desk” and “employee self service” are more recognizable than “internal IT support.”
- [HR chatbot vs HR helpdesk vs employee self service](https://trends.google.com/trends/explore?geo=US&date=today%205-y&q=HR%20chatbot,HR%20helpdesk,employee%20self%20service): average interest was 1, 0, and 64. This supports leading with employee self-service and policy access rather than chatbot terminology.
- Related queries for “HR chatbot” included “chatbot for HR services” as breakout, “chatbot for HR” at +130%, and “HR chatbot platform” at +70%. These are useful comparison-stage terms, but their low base interest makes them poor standalone market definitions.

Marketing implication: build the acquisition surface around employee handbook, employee self-service, onboarding, HR policy questions, and internal IT helpdesk. Explain that OrgChai uses AI, but do not make “AI chatbot” the only category label.

### What the market is teaching buyers

The category is moving toward answers grounded in company context, citations, and permission-aware access. Glean markets search across many workplace tools, real-time indexing, citations, and permission-aware results. Atlassian Rovo similarly emphasizes search across connected tools, personalized answers, citations, and agents. Slack positions Enterprise Search as a cross-app, permission-aware experience, but makes it available on Enterprise+ or Enterprise Grid with the relevant add-on.

This validates the underlying problem, but it also shows that a generic “AI search for work” message will put OrgChai next to much larger products. The initial wedge should be setup speed, narrow scope, controlled source documents, and a lower operational burden for teams that are not ready for enterprise search.

### YC and TechCrunch comparison signals

| Company | Evidence | ICP lesson |
| --- | --- | --- |
| [Leena AI, YC S18](https://www.ycombinator.com/companies/leena-ai) | Started with HR questions and expanded into HR service delivery. TechCrunch reported that its early focus was policy questions and that common topics included vacation, sick time, and expenses. | Verticalize around a repeated HR workflow first. The strongest OrgChai beachhead is employee policy and onboarding, not generic company search. |
| [Dashworks, YC W20](https://www.ycombinator.com/companies/dashworks) | TechCrunch described a start page and cross-tool search for Slack, Jira, Dropbox, Google Drive, Notion, and other systems. The company later joined HubSpot. | Broad internal search becomes connector- and security-heavy. Do not sell the current `.txt` product as a Dashworks or Glean substitute. |
| [Diana, YC W24](https://www.ycombinator.com/companies/diana) | Positions a secure AI assistant embedded in Slack for SMB operations, with roots in DianaHR and startup People Ops. | The SMB and Slack channel is commercially real, but generic Slack agents are moving toward actions and integrations. OrgChai should win on source-backed policy answers and controlled scope. |
| [OpenTag, YC S26](https://www.ycombinator.com/companies/opentag) | Positions a Slack AI coworker with company context, channel-level permissioning, and fast setup. | Permissioning and setup speed are becoming table stakes for Slack assistants. OrgChai should target a narrower, lower-risk document corpus until these foundations are stronger. |
| [Promptless, YC W25](https://www.ycombinator.com/companies/promptless) | Uses Slack, code, tickets, and documentation context to draft updates to customer-facing docs. | Knowledge freshness and maintenance are pain points. A future OrgChai differentiator could be identifying unanswered or stale policy questions, not only answering them. |
| [Glean, TechCrunch](https://techcrunch.com/2026/02/15/the-enterprise-ai-land-grab-is-on-glean-is-building-the-layer-beneath-the-interface/) | Competes as a broad enterprise knowledge and AI layer across many workplace systems. | The top of the market is crowded and well-funded. Avoid “Google for work” language and focus on a concrete employee self-service outcome. |

The repeated pattern is verticalization first, then expansion into connectors, governance, and actions. That supports an HR policy and onboarding beachhead for OrgChai.

### Competitive set

| Alternative | Market strength | Implication for OrgChai |
| --- | --- | --- |
| Slack AI and Enterprise Search | Already inside Slack, with AI answers and broader connected-app search on higher plans. | Sell to teams that need a focused policy/runbook layer without moving to an enterprise Slack search plan, while being honest that Slack’s native product is a direct threat as it expands. |
| Glean | Broad workplace search, citations, real-time indexing, permissions, and a large connector ecosystem. | Do not compete on breadth. Compete on a small, fast pilot for teams that do not need a knowledge graph or procurement-heavy rollout. |
| Guru | Governed knowledge and Slack access, including AI answers, search, and knowledge capture. | Differentiate on simplicity and a narrower internal-operations use case. Expect Guru to be a serious alternative for larger support and revenue teams. |
| Slite | Knowledge base plus AI search and connected-tool search. Its public pricing lists Basic at $10/user/month and Pro at $20/user/month when billed yearly. | Price and package around a focused answer workflow, not another general documentation workspace. Slite is a direct alternative when the buyer also wants to author and manage documents. |
| Atlassian Rovo | Included for eligible Atlassian Cloud plans, with search, chat, agents, connectors, and workflow actions. | Avoid Atlassian-heavy organizations unless the need is specifically a lightweight HR/IT layer outside their Jira/Confluence workflows. |
| Document360 and similar knowledge-base tools | Structured knowledge bases, public/private access, AI search, and content management. | Treat as adjacent. OrgChai is for employees asking questions, not for building a full external help center. |

Sources reviewed:

- [Glean workplace search](https://www.glean.com/enterprise-search) and [Glean product overview](https://docs.glean.com/user-guide/about/what-is-glean)
- [Slack Enterprise Search](https://slack.com/features/enterprise-search) and [Slack Enterprise Search access requirements](https://slack.com/help/articles/38693462131219-Search-across-your-applications-with-enterprise-search)
- [Guru in Slack](https://help.getguru.com/docs/searching-guru-in-slack)
- [Slite pricing](https://slite.com/pricing) and [Slite AI Search](https://slite.com/ai-search)
- [Atlassian Rovo plans and trial](https://www.atlassian.com/licensing/rovo)
- [Document360 AI for knowledge bases](https://docs.document360.com/docs/ai-for-knowledge-base-site)
- [Leena AI HR chatbot coverage in TechCrunch](https://techcrunch.com/2018/06/29/leena-ai-builds-hr-chat-bots-to-answer-policy-questions-automatically/)
- [Dashworks internal knowledge coverage in TechCrunch](https://techcrunch.com/2022/01/28/dashworks-is-a-search-engine-for-your-companys-sprawling-internal-knowledge/)
- [Google Trends: employee handbook, HR knowledge base, HR chatbot](https://trends.google.com/trends/explore?geo=US&date=today%205-y&q=employee%20handbook,HR%20knowledge%20base,HR%20chatbot)
- [Google Trends: IT help desk, internal IT support, employee self service](https://trends.google.com/trends/explore?geo=US&date=today%205-y&q=IT%20help%20desk,internal%20IT%20support,employee%20self%20service)
- [Google Trends: HR chatbot, HR helpdesk, employee self service](https://trends.google.com/trends/explore?geo=US&date=today%205-y&q=HR%20chatbot,HR%20helpdesk,employee%20self%20service)

## Positioning and message tests

### Recommended positioning

For 50 to 150 employee companies with lean People Ops teams, OrgChai is the employee self-service assistant that turns an approved handbook, policy set, and onboarding guide into source-backed answers in Slack and on the web. Unlike a generic AI assistant, it answers from the company’s chosen documents and shows the source. Unlike a full HRIS or enterprise search platform, it can start with one workflow and one administrator.

### Message options to test

1. “Give employees an answer from the handbook before they ask People Ops.”
2. “Turn your employee handbook into self-service answers in Slack.”
3. “Cut repeat HR and onboarding questions without adding another system of record.”
4. “Ask in Slack. Verify against the policy source.”

Lead with the operational outcome and the source-backed behavior. Use “AI” as a supporting description, not the main promise.

### Channels to test first

- Founder and operations communities focused on companies in the 50 to 150 employee range.
- Slack and workplace-operations communities where People Ops and IT managers discuss repeated internal support work.
- Search content for “employee self service,” “employee handbook questions,” “HR policy helpdesk,” “onboarding knowledge base,” and “internal IT helpdesk.” Create comparison pages for “HR chatbot” and “AI HR assistant” after the problem-led pages exist.
- Direct outreach to Heads of People, People Ops managers, COOs, and founders at 50 to 150 employee Slack companies with a trigger such as hiring growth, a new People Ops hire, a handbook refresh, or an employee self-service project.
- Partnerships with HR consultants, fractional COOs, HRIS implementers, MSPs, and small-company IT providers that already maintain handbooks and onboarding guides.
- Japan-focused SaaS and startup communities, using Japanese-language proof only after Japanese answer quality is validated with real policy questions.

## Qualification scorecard

Score each account before outreach. The account must pass both the hard gate and the intent score.

### Hard gate

- 50 to 150 employees.
- Slack is used daily by most employees.
- A Head of People, People Ops lead, COO, or founder can approve a pilot.
- One content owner can provide at least 20 approved policy or onboarding documents.
- The pilot can use a shared document corpus without document-level permissions.

### Intent score

Add one point for each item:

- A named People Ops, HRIS, onboarding, or internal-helpdesk initiative exists.
- The same policy or onboarding questions recur at least five times per week.
- The company hired at least 10 people in the last 12 months or is actively hiring across multiple functions.
- A new People Ops, HR, office, operations, or IT owner joined in the last six months.
- The buyer has a current handbook, benefits guide, onboarding guide, or IT guide that employees struggle to use.
- The buyer asks for a two-week pilot, source citations, or Slack access.
- The buyer can state a measurable outcome, such as fewer HR pings, faster onboarding answers, or fewer routine IT tickets.
- The buyer is comparing an intranet, HR chatbot, helpdesk bot, or enterprise-search product.

Interpretation:

- 6 to 8 points: prioritize for a discovery call and paid pilot.
- 4 to 5 points: nurture until a trigger becomes active.
- 0 to 3 points: do not prioritize.

### Disqualifiers

Disqualify or defer when the prospect requires source-level permissions, live HRIS data, Microsoft Teams as the only work surface, Slack-history retrieval, or action execution before the first pilot.

## Commercial fit hypothesis

This is a testable starting hypothesis, not a market fact:

- Paid pilot: $500 to $1,500 for two weeks, including source curation and one Slack workspace.
- Initial annual contract: $6,000 to $18,000 for a 50 to 150 employee company, priced by organization or active users rather than by document count.
- Economic case: recover five to ten hours per week of People Ops, operations, or IT time, plus faster new-hire self-service.

Do not optimize pricing before confirming that a buyer has a recurring question volume and a budget owner.

## Product changes that would expand the ICP

These are the highest-leverage gaps for moving upmarket or improving conversion. They are not required to validate the initial segment.

1. Ingest PDF, DOCX, Markdown, and common cloud sources, not only `.txt`.
2. Add document-level permissions and role-based administration.
3. Add source freshness, owner, review date, and approval status.
4. Add answer feedback, unanswered-question reporting, and usage analytics.
5. Add Slack message/thread indexing with permission-aware retrieval.
6. Add SSO/SCIM and a tenant-aware organization model.
7. Remove sensitive exception details from production errors and add a clear “not enough evidence” answer state.

## Validation plan

Build a list of 30 accounts that pass the hard gate, then interview 15 prospects: 10 with the HR/People Ops wedge and 5 with the IT self-service wedge. Compare triggered accounts against untriggered accounts. Ask:

- What internal questions were repeated in Slack last week?
- Who answered them, and how much time did that take?
- Where is the authoritative answer stored?
- How often do those documents change?
- Which formats and systems hold the knowledge?
- Would a shared document corpus be acceptable for a pilot?
- What security or procurement requirement would block a two-week test?
- What measurable outcome would justify paying for the product?
- Who can approve a two-week pilot, and what would block approval?
- Which search phrase or product category would you use if you were looking for this today?

For a pilot, measure:

- Questions answered without a human handoff.
- Time from question to verified answer.
- Repeat-question volume by topic.
- Percentage of answers with a useful source.
- Unanswered or low-confidence questions that reveal missing documentation.
- Weekly active users and repeat use after the first week.

The ICP should be narrowed further based on which segment has the shortest path from an active trigger to a paid pilot and a measurable reduction in internal support work.

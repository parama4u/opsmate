import type { Locale } from '@/i18n/routing';

export interface SeoPageSection {
  title: string;
  description: string;
}

export interface SeoPageStep {
  title: string;
  description: string;
}

export interface SeoPageFaq {
  question: string;
  answer: string;
}

export interface SeoPageContent {
  slug: string;
  eyebrow: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  image: string;
  sectionsTitle: string;
  sections: SeoPageSection[];
  stepsTitle: string;
  steps: SeoPageStep[];
  fitTitle: string;
  fitDescription: string;
  faqs: SeoPageFaq[];
  ctaTitle: string;
  ctaDescription: string;
  ctaLabel: string;
}

export const seoPageSlugs = [
  'employee-self-service-software',
  'hr-knowledge-base',
  'employee-onboarding-software',
  'slack-employee-support',
  'internal-it-helpdesk',
  'internal-knowledge-base-software',
  'employee-knowledge-base',
  'knowledge-base-analytics',
] as const;

type LocalizedSeoPages = Record<typeof seoPageSlugs[number], SeoPageContent>;

const englishPages: LocalizedSeoPages = {
  'employee-self-service-software': {
    slug: 'employee-self-service-software',
    eyebrow: 'Employee self-service software',
    title: 'Give employees answers before every question becomes a ticket.',
    metaTitle: 'Employee Self-Service Software for HR and IT Questions',
    metaDescription: 'Employee self-service software for source-backed answers to handbook, onboarding, benefits, and routine IT questions.',
    intro: 'OrgChai gives employees a clear place to ask questions and shows the approved source behind every answer. Start with the repeat work already consuming your People Ops and IT teams.',
    image: '/problem-people-ops.png',
    sectionsTitle: 'Built for the questions that repeat.',
    sections: [
      { title: 'Answer from approved sources', description: 'Index a focused set of handbooks, onboarding guides, security policies, and runbooks. Keep answers grounded in the documents your team owns.' },
      { title: 'Meet employees in the flow of work', description: 'Let employees ask in a web workspace or Slack instead of searching folders, scanning filenames, or waiting for a teammate.' },
      { title: 'See where self-service is working', description: 'Review repeated questions, source coverage, and documentation gaps so the content owner can improve the system over time.' },
    ],
    stepsTitle: 'A practical first rollout',
    steps: [
      { title: 'Choose the source set', description: 'Start with 20 to 80 documents that answer the questions your team receives most often.' },
      { title: 'Open the answer path', description: 'Give employees a consistent place to ask and a source they can verify.' },
      { title: 'Review the signal', description: 'Measure which repeat questions are deflected and which sources need attention.' },
    ],
    fitTitle: 'A fit for lean teams with a visible repeat-question problem.',
    fitDescription: 'OrgChai is designed for teams that need useful employee self-service without taking on a broad HR service delivery or enterprise search rollout.',
    faqs: [
      { question: 'What does employee self-service software do?', answer: 'It gives employees a searchable place to find approved answers and complete routine information requests without waiting for HR, People Ops, or IT.' },
      { question: 'Can OrgChai answer questions in Slack?', answer: 'Yes. OrgChai can provide the same source-backed answer path in Slack and in the web workspace.' },
      { question: 'Does OrgChai replace an HRIS?', answer: 'No. It sits in front of the documents and answers employees need while your HRIS and other systems remain the systems of record.' },
    ],
    ctaTitle: 'Start with the questions your team already sees.',
    ctaDescription: 'Bring a focused source set into a two-week pilot and see whether repeat internal questions go down.',
    ctaLabel: 'Start the pilot',
  },
  'hr-knowledge-base': {
    slug: 'hr-knowledge-base',
    eyebrow: 'HR knowledge base software',
    title: 'Turn scattered HR policies into answers employees can trust.',
    metaTitle: 'HR Knowledge Base Software with Source-Backed Answers',
    metaDescription: 'Build an HR knowledge base for handbook, leave, benefits, expenses, and workplace policy questions with verifiable sources.',
    intro: 'Give employees one reliable answer path for leave, benefits, expenses, remote work, and workplace policies. OrgChai makes the source visible so HR can improve access without losing control.',
    image: '/problem-people-ops.png',
    sectionsTitle: 'A knowledge base HR can own.',
    sections: [
      { title: 'Keep policy answers current', description: 'Use approved documents as the source set and make the content owner accountable for what is indexed.' },
      { title: 'Reduce the “ask HR” default', description: 'Answer common policy questions before they become a message, meeting, or manual lookup for the People Ops team.' },
      { title: 'Make the source part of the answer', description: 'Employees can see where an answer came from, which makes self-service easier to trust and easier to review.' },
    ],
    stepsTitle: 'From policy library to employee answer',
    steps: [
      { title: 'Select the policies', description: 'Start with the handbook, benefits guide, leave policy, and the documents behind your most common questions.' },
      { title: 'Test real questions', description: 'Use the exact language employees use, not only the titles your documents use.' },
      { title: 'Close the gaps', description: 'Use unanswered or repeated questions to prioritize the next content update.' },
    ],
    fitTitle: 'For People Ops teams that need leverage, not another system of record.',
    fitDescription: 'Use OrgChai as the answer layer around your existing HR systems and documents. It is intentionally bounded, source-first, and easy to pilot.',
    faqs: [
      { question: 'What should an HR knowledge base include?', answer: 'Start with the policies and procedures employees ask about most often, including leave, benefits, expenses, remote work, workplace conduct, and onboarding.' },
      { question: 'How does a source-backed HR knowledge base build trust?', answer: 'Each answer is tied to an approved document so employees can verify the policy and HR can review the source behind the response.' },
      { question: 'How long does an HR knowledge base pilot take?', answer: 'OrgChai is designed for a focused two-week first rollout using a small, approved document set.' },
    ],
    ctaTitle: 'Make the handbook easier to use.',
    ctaDescription: 'Start with the policies your team explains every week and give employees a clear answer path.',
    ctaLabel: 'Explore the pilot',
  },
  'employee-onboarding-software': {
    slug: 'employee-onboarding-software',
    eyebrow: 'Employee onboarding software',
    title: 'Give every new hire a reliable first week.',
    metaTitle: 'Employee Onboarding Software for Reliable First Weeks',
    metaDescription: 'Employee onboarding software that turns checklists, team norms, and setup guides into source-backed answers for new hires.',
    intro: 'New hires should not need to search five folders or wait for a manager to answer a basic question. OrgChai turns onboarding documents into a guided answer path employees can use when they need it.',
    image: '/problem-onboarding.png',
    sectionsTitle: 'Make the first week easier to navigate.',
    sections: [
      { title: 'Answer before the next meeting', description: 'Give new hires quick access to setup steps, team norms, benefits information, and first-week expectations.' },
      { title: 'Keep the checklist connected', description: 'Bring the handbook, onboarding checklist, account setup guide, and security instructions into one searchable source set.' },
      { title: 'Help managers stay out of the critical path', description: 'Let new hires resolve routine questions independently while managers focus on context, coaching, and team connection.' },
    ],
    stepsTitle: 'A smoother onboarding answer path',
    steps: [
      { title: 'Gather the first-week sources', description: 'Choose the documents a new hire needs before day one and during the first few weeks.' },
      { title: 'Ask the questions out loud', description: 'Test questions such as “What should I complete before my first day?” against the source set.' },
      { title: 'Improve the handoff', description: 'Use repeated questions to clarify the checklist and strengthen the onboarding experience.' },
    ],
    fitTitle: 'For growing teams where onboarding questions still reach a person.',
    fitDescription: 'OrgChai supports the human side of onboarding by handling the predictable information layer. It does not replace your HRIS, manager, or onboarding owner.',
    faqs: [
      { question: 'What does employee onboarding software help with?', answer: 'It organizes the information, tasks, and guidance new hires need before and during their first weeks so they can move forward with less waiting.' },
      { question: 'Can onboarding answers come from existing documents?', answer: 'Yes. OrgChai uses approved onboarding checklists, handbooks, team guides, and setup instructions as the source set.' },
      { question: 'Can employees ask onboarding questions in Slack?', answer: 'Yes. New hires can use the web workspace or Slack to ask natural-language questions against the same controlled source set.' },
    ],
    ctaTitle: 'Make the first week feel less fragmented.',
    ctaDescription: 'Start with the onboarding questions managers answer repeatedly and turn them into a dependable source-backed workflow.',
    ctaLabel: 'Start an onboarding pilot',
  },
  'slack-employee-support': {
    slug: 'slack-employee-support',
    eyebrow: 'Slack employee support',
    title: 'Give employees answers in Slack without turning every channel into a helpdesk.',
    metaTitle: 'Slack Employee Support for HR, Onboarding, and IT Questions',
    metaDescription: 'Source-backed Slack employee support for handbook, onboarding, benefits, security, and routine IT questions.',
    intro: 'Employees already ask questions in Slack. OrgChai helps them find approved answers there while keeping your source set, answer boundaries, and content ownership clear.',
    image: '/problem-it-ops.png',
    sectionsTitle: 'Support in the place employees already use.',
    sections: [
      { title: 'Answer routine questions in context', description: 'Give employees a useful response without asking them to leave Slack and search another system.' },
      { title: 'Keep answers grounded', description: 'Use approved sources for policy, onboarding, security, and setup questions instead of relying on unsourced replies.' },
      { title: 'Protect the team from interruptions', description: 'Deflect repeat questions while keeping complex, sensitive, or out-of-scope issues with the right owner.' },
    ],
    stepsTitle: 'A bounded Slack support workflow',
    steps: [
      { title: 'Define the answer boundary', description: 'Choose the question types and documents the first pilot should cover.' },
      { title: 'Connect the repeat path', description: 'Let employees ask in Slack and receive a concise answer with its source.' },
      { title: 'Route the exceptions', description: 'Use unanswered questions and feedback to identify when a person should step in.' },
    ],
    fitTitle: 'For teams that want Slack access without Slack chaos.',
    fitDescription: 'OrgChai is a source-backed answer layer, not an autonomous agent that posts, changes systems, or replaces your existing support process.',
    faqs: [
      { question: 'Can Slack be used for employee support?', answer: 'Yes. Slack works well for routine employee questions when answers are grounded in approved sources and exceptions have a clear owner.' },
      { question: 'Does OrgChai post or change Slack messages?', answer: 'The product is designed around answering questions and linking to sources. It does not modify messages or take autonomous actions across business systems.' },
      { question: 'What types of Slack questions can OrgChai answer?', answer: 'Common starting points include handbook, benefits, onboarding, security, setup, and routine IT questions that can be answered from approved documents.' },
    ],
    ctaTitle: 'Make Slack a clearer front door for repeat questions.',
    ctaDescription: 'Start with one channel of repeat questions and a source set your team already trusts.',
    ctaLabel: 'See the Slack pilot',
  },
  'internal-it-helpdesk': {
    slug: 'internal-it-helpdesk',
    eyebrow: 'Internal IT helpdesk software',
    title: 'Deflect routine IT questions before they interrupt the team.',
    metaTitle: 'Internal IT Helpdesk Software for Routine Employee Questions',
    metaDescription: 'Internal IT helpdesk software for source-backed setup, access, security, and troubleshooting answers in Slack and on the web.',
    intro: 'Small IT and operations teams should not be the only searchable source for setup, access, security, and troubleshooting guidance. OrgChai makes the approved first answer easier to find.',
    image: '/problem-it-ops.png',
    sectionsTitle: 'Reduce the routine without hiding the exceptions.',
    sections: [
      { title: 'Surface the approved procedure', description: 'Turn runbooks, security guides, setup instructions, and access documentation into answers employees can use.' },
      { title: 'Keep sensitive work with the team', description: 'Use a bounded source set for information requests and route anything requiring approval, access, or investigation to a person.' },
      { title: 'Find the next documentation gap', description: 'Repeated questions show where a runbook or employee-facing instruction needs to be clearer.' },
    ],
    stepsTitle: 'A practical internal IT starting point',
    steps: [
      { title: 'Choose routine topics', description: 'Start with the questions that repeat: setup, access, security reporting, and common troubleshooting.' },
      { title: 'Index the approved guides', description: 'Use the runbooks and instructions your IT team already trusts.' },
      { title: 'Review exceptions', description: 'Keep approvals and sensitive actions with the right owner while self-service handles the information layer.' },
    ],
    fitTitle: 'For lean IT teams with too many low-complexity interruptions.',
    fitDescription: 'OrgChai helps employees find the next approved step. It is not a ticketing system, endpoint manager, or autonomous administrator.',
    faqs: [
      { question: 'What is an internal IT helpdesk knowledge base?', answer: 'It is a searchable collection of approved setup, access, security, and troubleshooting guidance that helps employees resolve routine issues before opening a request.' },
      { question: 'Can OrgChai replace an IT ticketing system?', answer: 'No. It helps deflect routine information requests while your ticketing and escalation systems continue to handle work that needs an IT owner.' },
      { question: 'How should a small IT team start?', answer: 'Choose a narrow source set and a few recurring questions, then review whether employees reach the right guidance without an interruption.' },
    ],
    ctaTitle: 'Start with the tickets that should not be tickets.',
    ctaDescription: 'Turn a small set of trusted IT guides into a source-backed first response for employees.',
    ctaLabel: 'Start the IT pilot',
  },
  'internal-knowledge-base-software': {
    slug: 'internal-knowledge-base-software',
    eyebrow: 'Internal knowledge base software',
    title: 'Choose the right source set before you scale self-service.',
    metaTitle: 'Internal Knowledge Base Software for Controlled Employee Self-Service',
    metaDescription: 'Internal knowledge base software for selecting approved HR, onboarding, security, and IT sources before launching employee self-service.',
    intro: 'A useful internal knowledge base starts with a controlled source set, not a giant document dump. OrgChai helps teams choose the documents behind the questions employees actually ask.',
    image: '/problem-people-ops.png',
    sectionsTitle: 'Start with sources your team can stand behind.',
    sections: [
      { title: 'Focus on repeat questions', description: 'Choose policies, checklists, and runbooks that answer visible employee questions instead of indexing every file.' },
      { title: 'Keep ownership clear', description: 'Give one content owner responsibility for what is added, reviewed, and removed from the source set.' },
      { title: 'Expand after proof', description: 'Use the first pilot to learn which topics deserve broader coverage and which sources need cleanup.' },
    ],
    stepsTitle: 'How to build the first source set',
    steps: [
      { title: 'List the repeat questions', description: 'Pull the last few weeks of handbook, onboarding, benefits, and IT questions into one short list.' },
      { title: 'Select the source documents', description: 'Choose the approved documents that answer those questions and remove stale duplicates.' },
      { title: 'Test before expanding', description: 'Ask real employee questions and review whether the answer points to the right source.' },
    ],
    fitTitle: 'For teams that need a useful internal knowledge base without a migration project.',
    fitDescription: 'OrgChai is designed for a narrow, accountable first rollout. It complements your document storage and systems of record.',
    faqs: [
      { question: 'What is internal knowledge base software?', answer: 'It helps employees find trusted company information while giving the content owner control over the sources behind those answers.' },
      { question: 'How many documents should an internal knowledge base start with?', answer: 'Start with the smallest source set that covers the repeat questions you want to reduce. OrgChai is designed for a focused first set of roughly 20 to 80 approved documents.' },
      { question: 'Should every company document be indexed?', answer: 'No. A smaller, current, and clearly owned source set is easier to review and more useful than an unbounded document archive.' },
    ],
    ctaTitle: 'Build the source set around real questions.',
    ctaDescription: 'Start with the documents your team already trusts and learn what employees need next.',
    ctaLabel: 'Start the source pilot',
  },
  'employee-knowledge-base': {
    slug: 'employee-knowledge-base',
    eyebrow: 'Employee knowledge base',
    title: 'Give employees one answer path for the work they ask about every week.',
    metaTitle: 'Employee Knowledge Base for HR, Onboarding, and IT Answers',
    metaDescription: 'Employee knowledge base software for answering recurring HR, onboarding, benefits, security, and routine IT questions from approved sources.',
    intro: 'Employees do not think in document folders. They ask questions. OrgChai turns the approved information behind those questions into a clear, searchable answer path.',
    image: '/problem-onboarding.png',
    sectionsTitle: 'Make internal knowledge easier to use.',
    sections: [
      { title: 'Ask in natural language', description: 'Let employees ask the question they have instead of guessing which policy title or folder contains the answer.' },
      { title: 'Show the supporting source', description: 'Make the answer easier to trust by showing the document and policy behind it.' },
      { title: 'Serve more than one team', description: 'Start with HR, onboarding, or IT and grow the knowledge base as the first workflow proves useful.' },
    ],
    stepsTitle: 'From employee question to answer',
    steps: [
      { title: 'Collect the questions', description: 'Use messages, support requests, and onboarding conversations to identify the highest-frequency topics.' },
      { title: 'Connect the answer path', description: 'Give employees a web workspace or Slack entry point for the same controlled source set.' },
      { title: 'Improve the experience', description: 'Use feedback and unanswered questions to make the source set clearer over time.' },
    ],
    fitTitle: 'For People Ops and IT teams that are tired of being the search engine.',
    fitDescription: 'The employee knowledge base works around your existing systems. It answers information requests and keeps approvals and system changes with the right owner.',
    faqs: [
      { question: 'What should an employee knowledge base contain?', answer: 'Start with the documents behind recurring questions, such as handbook policies, benefits, onboarding, security guidance, and routine IT procedures.' },
      { question: 'Can employees search an employee knowledge base in Slack?', answer: 'Yes. OrgChai supports a consistent answer path in Slack and in the web workspace.' },
      { question: 'How is an employee knowledge base different from shared folders?', answer: 'It starts with the question employees ask, then returns a concise answer with the approved source instead of making the employee search folders manually.' },
    ],
    ctaTitle: 'Make the answer path visible to employees.',
    ctaDescription: 'Start with one repeated workflow and give employees a reliable place to ask.',
    ctaLabel: 'Start the answer pilot',
  },
  'knowledge-base-analytics': {
    slug: 'knowledge-base-analytics',
    eyebrow: 'Knowledge base analytics',
    title: 'See which questions your knowledge base answers, and which it misses.',
    metaTitle: 'Knowledge Base Analytics for Employee Questions and Source Gaps',
    metaDescription: 'Knowledge base analytics for tracking repeat employee questions, source coverage, unanswered topics, and documentation gaps.',
    intro: 'A knowledge base is only useful when employees can find the right answer. OrgChai helps teams review the questions coming in, the sources being used, and the gaps worth fixing next.',
    image: '/problem-it-ops.png',
    sectionsTitle: 'Turn repeat questions into a content signal.',
    sections: [
      { title: 'Find unanswered topics', description: 'See where employees still need a person because the source set is missing, unclear, or out of date.' },
      { title: 'Prioritize useful updates', description: 'Use repeated questions to decide which policy, checklist, or runbook should be improved first.' },
      { title: 'Keep the owner in control', description: 'Review coverage and gaps without handing content decisions to an autonomous system.' },
    ],
    stepsTitle: 'A simple review loop',
    steps: [
      { title: 'Capture real questions', description: 'Start with the language employees use in Slack, support requests, and onboarding conversations.' },
      { title: 'Review source coverage', description: 'Check whether the source set provides a clear answer for the topics that repeat.' },
      { title: 'Improve and repeat', description: 'Update the right document, then watch whether the same question keeps returning.' },
    ],
    fitTitle: 'For teams that want evidence before expanding their knowledge base.',
    fitDescription: 'Use analytics to guide content ownership and rollout decisions. OrgChai focuses on the answer layer, not vanity dashboards.',
    faqs: [
      { question: 'What should knowledge base analytics measure?', answer: 'Useful signals include repeated questions, unanswered topics, source coverage, feedback, and the documentation gaps that create avoidable work.' },
      { question: 'Can analytics show which documents need improvement?', answer: 'Yes. Repeated or unanswered questions can point the content owner toward the policy, checklist, or runbook that needs attention.' },
      { question: 'Does OrgChai make content changes automatically?', answer: 'No. It surfaces the signal while the content owner decides what should be reviewed, updated, or added.' },
    ],
    ctaTitle: 'Review what your employees are still asking.',
    ctaDescription: 'Use a focused pilot to see where self-service works and where the source set needs attention.',
    ctaLabel: 'Review the pilot signal',
  },
};

const japanesePages: LocalizedSeoPages = {
  'employee-self-service-software': {
    ...englishPages['employee-self-service-software'],
    eyebrow: '社員セルフサービスソフトウェア',
    title: 'すべての質問をチケットにする前に、社員が答えを見つけられるようにする。',
    metaTitle: 'HR・IT の質問に答える社員セルフサービスソフトウェア',
    metaDescription: 'ハンドブック、オンボーディング、福利厚生、定型 IT の質問に出典付きで答える社員セルフサービスソフトウェア。',
    intro: 'OrgChai は、社員が質問できる場所と、承認済みの出典を示す回答を提供します。People Ops と IT が繰り返し対応している質問から始められます。',
    sectionsTitle: '繰り返される質問のために設計。',
    sections: [
      { title: '承認済みソースから回答', description: 'ハンドブック、オンボーディング、セキュリティ規程、手順書を範囲を決めて登録します。' },
      { title: '社員が使う場所で回答', description: 'フォルダーを探したり、担当者を待ったりせず、Web ワークスペースまたは Slack で質問できます。' },
      { title: 'セルフサービスの効果を確認', description: '繰り返し質問、出典の網羅性、文書の不足を確認できます。' },
    ],
    stepsTitle: '実務的な初回展開',
    steps: [
      { title: 'ソースを選ぶ', description: '頻繁に聞かれる質問に答える文書 20〜80 件から始めます。' },
      { title: '回答経路を開く', description: '社員に一貫した質問場所と、確認できる出典を提供します。' },
      { title: '変化を確認', description: '繰り返し質問が減ったか、次に整備すべきソースは何かを確認します。' },
    ],
    fitTitle: '繰り返し質問が見えている少人数チーム向け。',
    fitDescription: '大規模な HR サービス管理やエンタープライズ検索の展開を始めず、役立つ社員セルフサービスを実現します。',
    faqs: [
      { question: '社員セルフサービスソフトウェアとは？', answer: '社員が承認済みの回答を探し、HR、People Ops、IT を待たずに定型的な情報を確認できる場所です。' },
      { question: 'OrgChai は Slack で回答できますか？', answer: 'はい。Web ワークスペースと Slack で同じ出典付きの回答経路を使えます。' },
      { question: 'OrgChai は HRIS を置き換えますか？', answer: 'いいえ。HRIS や他の記録システムを維持したまま、その前段で必要な情報を見つけやすくします。' },
    ],
    ctaTitle: 'すでに発生している質問から始める。',
    ctaDescription: '範囲を決めたソースで 2 週間のパイロットを始め、繰り返し質問が減るかを確認します。',
    ctaLabel: 'パイロットを始める',
  },
  'hr-knowledge-base': {
    ...englishPages['hr-knowledge-base'],
    eyebrow: 'HR ナレッジベースソフトウェア',
    title: '散在した HR 規程を、社員が信頼できる回答に変える。',
    metaTitle: '出典付き回答のための HR ナレッジベースソフトウェア',
    metaDescription: '休暇、福利厚生、経費、リモートワーク、職場規程の質問に出典付きで答える HR ナレッジベース。',
    intro: '休暇、福利厚生、経費、リモートワーク、職場規程について、社員に信頼できる回答経路を提供します。',
    sectionsTitle: 'People Ops が管理できるナレッジベース。',
    sections: [
      { title: '規程の回答を最新に保つ', description: '承認済み文書をソースにし、担当者が登録内容を管理します。' },
      { title: '「まず HR に聞く」を減らす', description: 'メッセージや会議になる前に、よくある規程質問へ回答します。' },
      { title: '回答と出典を一緒に示す', description: '社員も HR も、回答の根拠となる規程を確認できます。' },
    ],
    stepsTitle: '規程から社員向け回答へ',
    steps: [
      { title: '規程を選ぶ', description: 'ハンドブック、福利厚生、休暇など頻繁に聞かれる文書から始めます。' },
      { title: '実際の質問で確認', description: '文書タイトルではなく、社員が使う言葉で試します。' },
      { title: '不足を整える', description: '回答できない質問や繰り返し質問から、次の更新を決めます。' },
    ],
    fitTitle: '新しい記録システムではなく、People Ops の余力が必要なチーム向け。',
    fitDescription: '既存の HR システムと文書の周りに、範囲を決めた回答レイヤーを追加します。',
    faqs: [
      { question: 'HR ナレッジベースには何を入れますか？', answer: '休暇、福利厚生、経費、リモートワーク、職場ルール、オンボーディングなど、頻繁に聞かれる規程から始めます。' },
      { question: '出典付き回答はなぜ重要ですか？', answer: '社員が規程を確認でき、HR も回答の根拠をレビューできるためです。' },
      { question: 'HR ナレッジベースのパイロット期間は？', answer: 'OrgChai は、承認済みの小さな文書セットで 2 週間の初回展開を想定しています。' },
    ],
    ctaTitle: 'ハンドブックを使いやすくする。',
    ctaDescription: '毎週説明している規程から始め、社員に明確な回答経路を提供します。',
    ctaLabel: 'パイロットを見る',
  },
  'employee-onboarding-software': {
    ...englishPages['employee-onboarding-software'],
    eyebrow: '社員オンボーディングソフトウェア',
    title: 'すべての新入社員に、確かな初週を提供する。',
    metaTitle: '確かな初週を作る社員オンボーディングソフトウェア',
    metaDescription: 'チェックリスト、チームルール、設定ガイドを新入社員向けの出典付き回答に変えるオンボーディングソフトウェア。',
    intro: '新入社員が 5 つのフォルダーを探したり、マネージャーの回答を待ったりする必要をなくします。',
    sectionsTitle: '初週の進め方をわかりやすく。',
    sections: [
      { title: '次の会議を待たずに回答', description: '設定手順、チームルール、福利厚生、初週の予定をすぐに確認できます。' },
      { title: 'チェックリストをつなぐ', description: 'ハンドブック、チェックリスト、アカウント設定、セキュリティ手順を一つのソースにまとめます。' },
      { title: 'マネージャーの中断を減らす', description: '定型的な質問を新入社員が自分で解決し、マネージャーは対話と支援に集中できます。' },
    ],
    stepsTitle: 'オンボーディングの回答経路',
    steps: [
      { title: '初週のソースを集める', description: '入社前と初週に必要な文書を選びます。' },
      { title: '質問をそのまま試す', description: '「初出社日までに何を完了すればよいですか？」のような質問で確認します。' },
      { title: '引き継ぎを改善する', description: '繰り返し質問からチェックリストと案内を整えます。' },
    ],
    fitTitle: 'オンボーディングの質問が担当者に届き続ける成長企業向け。',
    fitDescription: '人による支援を置き換えるのではなく、定型的な情報提供をわかりやすくします。',
    faqs: [
      { question: '社員オンボーディングソフトウェアとは？', answer: '新入社員が初週に必要な情報、タスク、案内を見つけ、待ち時間を減らすためのソフトウェアです。' },
      { question: '既存の文書からオンボーディング回答を作れますか？', answer: 'はい。チェックリスト、ハンドブック、チームガイド、設定手順をソースにできます。' },
      { question: 'Slack でオンボーディング質問をできますか？', answer: 'はい。Web ワークスペースと Slack の両方から自然な言葉で質問できます。' },
    ],
    ctaTitle: '初週の分断を減らす。',
    ctaDescription: 'マネージャーが繰り返し答えるオンボーディング質問から始めます。',
    ctaLabel: 'パイロットを始める',
  },
  'slack-employee-support': {
    ...englishPages['slack-employee-support'],
    eyebrow: 'Slack 社員サポート',
    title: 'Slack で回答しながら、すべてのチャンネルをヘルプデスクにしない。',
    metaTitle: 'HR・オンボーディング・IT のための Slack 社員サポート',
    metaDescription: 'ハンドブック、オンボーディング、福利厚生、セキュリティ、定型 IT の質問に出典付きで答える Slack 社員サポート。',
    intro: '社員がすでに使っている Slack で質問に答えます。ソース、回答範囲、担当者を明確に保てます。',
    sectionsTitle: '社員が使う場所でサポート。',
    sections: [
      { title: '文脈の中で定型質問に回答', description: '別のシステムを検索する前に、Slack で役立つ回答を提供します。' },
      { title: '回答を根拠につなぐ', description: '規程、オンボーディング、セキュリティ、設定の質問を承認済みソースから回答します。' },
      { title: '中断からチームを守る', description: '繰り返し質問を減らし、複雑な相談は担当者へつなぎます。' },
    ],
    stepsTitle: '範囲を決めた Slack サポート',
    steps: [
      { title: '回答範囲を決める', description: '初回パイロットで扱う質問と文書を選びます。' },
      { title: '繰り返し経路をつなぐ', description: 'Slack で質問し、出典付きの簡潔な回答を受け取ります。' },
      { title: '例外をつなぐ', description: '担当者が必要な質問を見つけ、適切な人へ渡します。' },
    ],
    fitTitle: 'Slack の利便性と、回答の管理を両立したいチーム向け。',
    fitDescription: 'OrgChai は出典付きの回答レイヤーです。メッセージの変更や業務システム横断の自律アクションは行いません。',
    faqs: [
      { question: 'Slack は社員サポートに使えますか？', answer: 'はい。承認済みソースと明確な担当者があれば、定型的な社員質問に向いています。' },
      { question: 'OrgChai は Slack のメッセージを変更しますか？', answer: 'いいえ。質問への回答と出典の提示を中心にし、メッセージや業務システムを自律的に変更しません。' },
      { question: 'どのような質問に回答できますか？', answer: 'ハンドブック、福利厚生、オンボーディング、セキュリティ、設定、定型 IT の質問が開始点になります。' },
    ],
    ctaTitle: 'Slack を定型質問の明確な入口にする。',
    ctaDescription: '繰り返し質問が集まる場所と、信頼できるソースから始めます。',
    ctaLabel: 'Slack パイロットを見る',
  },
  'internal-it-helpdesk': {
    ...englishPages['internal-it-helpdesk'],
    eyebrow: '社内 IT ヘルプデスクソフトウェア',
    title: 'チームを中断する前に、定型 IT 質問へ答える。',
    metaTitle: '社員の定型質問に答える社内 IT ヘルプデスクソフトウェア',
    metaDescription: '設定、アクセス、セキュリティ、トラブルシューティングを Slack と Web で案内する社内 IT ヘルプデスクソフトウェア。',
    intro: '少人数の IT・業務チームだけが設定、アクセス、セキュリティ、トラブルシューティングの検索エンジンになる状態を減らします。',
    sectionsTitle: '定型業務を減らし、例外は残す。',
    sections: [
      { title: '承認済み手順を提示', description: '手順書、セキュリティガイド、設定手順、アクセス文書を回答に変えます。' },
      { title: '機密業務はチームに残す', description: '承認や調査が必要な相談は担当者へつなぎ、情報提供だけをセルフサービスにします。' },
      { title: '次の文書不足を見つける', description: '繰り返し質問から、手順書や社員向け案内の改善点を見つけます。' },
    ],
    stepsTitle: '社内 IT の現実的な開始点',
    steps: [
      { title: '定型テーマを選ぶ', description: '設定、アクセス、セキュリティ報告、よくあるトラブルから始めます。' },
      { title: 'ガイドを登録する', description: 'IT チームが信頼する手順書と案内を使います。' },
      { title: '例外を確認する', description: '承認と機密操作は担当者に残し、情報提供だけをセルフサービスにします。' },
    ],
    fitTitle: '低複雑度の中断が多い少人数 IT チーム向け。',
    fitDescription: '社員が次の承認済み手順を見つけられるようにします。チケットシステムや端末管理を置き換えるものではありません。',
    faqs: [
      { question: '社内 IT ヘルプデスクのナレッジベースとは？', answer: '設定、アクセス、セキュリティ、トラブルシューティングの案内を検索でき、定型依頼を減らすための文書集合です。' },
      { question: 'OrgChai は IT チケットシステムを置き換えますか？', answer: 'いいえ。情報提供で解決できる質問を減らし、担当者が必要な相談は既存のチケットとエスカレーションに残します。' },
      { question: '少人数 IT チームはどう始めるべきですか？', answer: '信頼できる小さなソースセットと繰り返し質問から始め、適切な案内にたどり着けるかを確認します。' },
    ],
    ctaTitle: 'チケットにしなくてよい質問から始める。',
    ctaDescription: '信頼できる IT ガイドを、社員向けの出典付き一次回答に変えます。',
    ctaLabel: 'IT パイロットを始める',
  },
  'internal-knowledge-base-software': {
    ...englishPages['internal-knowledge-base-software'],
    eyebrow: '社内ナレッジベースソフトウェア',
    title: 'セルフサービスを広げる前に、適切なソースを選ぶ。',
    metaTitle: '管理された社員セルフサービスのための社内ナレッジベース',
    metaDescription: '社員セルフサービスを始める前に、HR、オンボーディング、セキュリティ、IT の承認済みソースを選ぶナレッジベースソフトウェア。',
    intro: '社内ナレッジベースは、大量の文書を登録することではなく、社員が実際に聞く質問に答えるソースを選ぶことから始まります。',
    sectionsTitle: 'チームが責任を持てるソースから始める。',
    sections: [
      { title: '繰り返し質問に集中', description: 'すべてのファイルではなく、社員の質問に答える規程、チェックリスト、手順書を選びます。' },
      { title: '担当者を明確にする', description: '追加、確認、削除するソースをコンテンツ担当者が管理します。' },
      { title: '効果を確認して広げる', description: '初回パイロットで、次に必要なテーマと整理すべきソースを見つけます。' },
    ],
    stepsTitle: '最初のソースセットを作る方法',
    steps: [
      { title: '繰り返し質問を集める', description: 'ハンドブック、オンボーディング、福利厚生、IT の質問を短いリストにします。' },
      { title: '文書を選ぶ', description: '質問に答える承認済み文書を選び、古い重複文書を外します。' },
      { title: '広げる前に試す', description: '実際の質問で適切なソースにたどり着けるかを確認します。' },
    ],
    fitTitle: '移行プロジェクトを始めず、役立つ社内ナレッジを作りたいチーム向け。',
    fitDescription: '既存の文書保管場所や記録システムを補完し、範囲を決めて展開します。',
    faqs: [
      { question: '社内ナレッジベースソフトウェアとは？', answer: '社員が信頼できる社内情報を見つけ、回答の根拠となるソースを担当者が管理するためのソフトウェアです。' },
      { question: '最初に何件の文書を登録しますか？', answer: '減らしたい繰り返し質問をカバーできる最小限の文書から始めます。OrgChai は 20〜80 件程度の初回ソースを想定しています。' },
      { question: 'すべての社内文書を登録すべきですか？', answer: 'いいえ。範囲が明確で最新のソースの方が、無制限の文書アーカイブより確認しやすく役立ちます。' },
    ],
    ctaTitle: '実際の質問を中心にソースを作る。',
    ctaDescription: 'チームがすでに信頼している文書から始め、次に必要な情報を確認します。',
    ctaLabel: 'ソースパイロットを始める',
  },
  'employee-knowledge-base': {
    ...englishPages['employee-knowledge-base'],
    eyebrow: '社員ナレッジベース',
    title: '毎週聞かれる業務の質問に、一つの回答経路を提供する。',
    metaTitle: 'HR・オンボーディング・IT のための社員ナレッジベース',
    metaDescription: '承認済みソースから HR、オンボーディング、福利厚生、セキュリティ、定型 IT の質問に答える社員ナレッジベース。',
    intro: '社員は文書フォルダーではなく質問を考えます。OrgChai は、その質問の背景にある承認済み情報を回答経路に変えます。',
    sectionsTitle: '社内ナレッジを使いやすくする。',
    sections: [
      { title: '自然な言葉で質問', description: 'どの規程タイトルかを推測せず、社員が持っている質問をそのまま入力できます。' },
      { title: '根拠となるソースを表示', description: '回答の背景にある文書を示し、確認しやすくします。' },
      { title: '複数チームに対応', description: 'HR、オンボーディング、IT のいずれかから始め、効果を確認して広げます。' },
    ],
    stepsTitle: '社員の質問から回答へ',
    steps: [
      { title: '質問を集める', description: 'メッセージ、サポート依頼、オンボーディング会話から頻度の高いテーマを見つけます。' },
      { title: '回答経路をつなぐ', description: '同じ管理されたソースを Web ワークスペースまたは Slack から使えるようにします。' },
      { title: '体験を改善する', description: 'フィードバックと未回答の質問からソースを改善します。' },
    ],
    fitTitle: 'People Ops と IT が検索エンジンになる状態を減らしたいチーム向け。',
    fitDescription: '既存システムの周りで情報質問に答え、承認やシステム変更は適切な担当者に残します。',
    faqs: [
      { question: '社員ナレッジベースには何を入れますか？', answer: 'ハンドブック、福利厚生、オンボーディング、セキュリティ、定型 IT の文書から始めます。' },
      { question: 'Slack で社員ナレッジを検索できますか？', answer: 'はい。Slack と Web ワークスペースで同じ回答経路を使えます。' },
      { question: '共有フォルダーとの違いは？', answer: '社員が持つ質問から始め、承認済みソースと簡潔な回答を返すため、手動でフォルダーを探す必要がありません。' },
    ],
    ctaTitle: '社員に回答経路を見えるようにする。',
    ctaDescription: '繰り返し発生する一つの業務から始め、質問できる場所を用意します。',
    ctaLabel: '回答パイロットを始める',
  },
  'knowledge-base-analytics': {
    ...englishPages['knowledge-base-analytics'],
    eyebrow: 'ナレッジベース分析',
    title: '答えられた質問と、まだ答えられない質問を確認する。',
    metaTitle: '社員の質問とソース不足を確認するナレッジベース分析',
    metaDescription: '繰り返し質問、出典の網羅性、未回答テーマ、文書不足を確認するナレッジベース分析。',
    intro: 'ナレッジベースは、社員が適切な回答を見つけて初めて役立ちます。OrgChai は質問、利用されたソース、次に整えるべき不足を確認できるようにします。',
    sectionsTitle: '繰り返し質問をコンテンツのシグナルに変える。',
    sections: [
      { title: '未回答テーマを見つける', description: 'ソース不足、内容の不明確さ、古さによって担当者が必要なテーマを確認します。' },
      { title: '更新を優先する', description: '繰り返し質問から、最初に改善すべき規程、チェックリスト、手順書を決めます。' },
      { title: '担当者が管理する', description: '自律システムに任せず、コンテンツ担当者が不足と更新を確認します。' },
    ],
    stepsTitle: 'シンプルな確認サイクル',
    steps: [
      { title: '実際の質問を集める', description: 'Slack、サポート依頼、オンボーディング会話で社員が使う言葉を確認します。' },
      { title: 'ソースの網羅性を確認', description: '繰り返されるテーマに、明確な回答を返せるかを確認します。' },
      { title: '改善して再確認', description: '適切な文書を更新し、同じ質問が減ったかを見ます。' },
    ],
    fitTitle: 'ナレッジベースを広げる前に根拠を確認したいチーム向け。',
    fitDescription: 'コンテンツ管理と展開判断のためにシグナルを使います。OrgChai は見栄えだけのダッシュボードではなく、回答レイヤーに集中します。',
    faqs: [
      { question: 'ナレッジベース分析では何を見ますか？', answer: '繰り返し質問、未回答テーマ、出典の網羅性、フィードバック、不要な業務を生む文書不足を確認します。' },
      { question: '改善が必要な文書を特定できますか？', answer: 'はい。繰り返し質問や未回答テーマから、確認すべき規程、チェックリスト、手順書を見つけられます。' },
      { question: 'OrgChai は自動で文書を変更しますか？', answer: 'いいえ。シグナルを示し、レビューや更新の判断はコンテンツ担当者が行います。' },
    ],
    ctaTitle: '社員がまだ聞いている質問を確認する。',
    ctaDescription: 'パイロットでセルフサービスが機能する場所と、ソースを整える場所を確認します。',
    ctaLabel: 'パイロットのシグナルを見る',
  },
};

export function getSeoPage(locale: Locale, slug: string): SeoPageContent | undefined {
  if (!seoPageSlugs.includes(slug as typeof seoPageSlugs[number])) return undefined;
  return (locale === 'ja' ? japanesePages : englishPages)[slug as typeof seoPageSlugs[number]];
}

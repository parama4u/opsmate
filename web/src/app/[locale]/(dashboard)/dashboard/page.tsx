'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ChatShell } from '@/components/chat/ChatShell';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import {
  useChats,
  useChat,
  useDocuments,
  useCreateChat,
  useDeleteChat,
  useSendMessage,
  useUploadDocument,
  useDeleteDocument,
  useFeedback,
  useCreateActionProposal,
} from '@/lib/query/hooks';

export default function DashboardPage() {
  const { user, isAdmin, role } = useAuth();
  const [initialContext, setInitialContext] = useState('');

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('context');
    if (!raw) return;
    try {
      const context = JSON.parse(raw) as { title?: string; url?: string; selection?: string };
      setInitialContext([
        context.title ? `Page: ${context.title}` : null,
        context.url ? `URL: ${context.url}` : null,
        context.selection ? `Selected text:\n${context.selection}` : null,
        'Question about this page: ',
      ].filter(Boolean).join('\n'));
    } catch {
      setInitialContext('');
    }
  }, []);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const chatsQuery = useChats(Boolean(user));
  const chatQuery = useChat(activeChatId);
  const docsQuery = useDocuments(Boolean(user));
  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const sendMessage = useSendMessage();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();
  const feedback = useFeedback(activeChatId);
  const createActionProposal = useCreateActionProposal();

  const chats = chatsQuery.data ?? [];
  const messages = chatQuery.data?.messages ?? [];
  const documents = docsQuery.data?.documents ?? {};
  const sending = sendMessage.isPending;

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);

  const newChat = useCallback(async () => {
    const chat = await createChat.mutateAsync();
    setActiveChatId(chat.id);
  }, [createChat]);

  const onDeleteChat = useCallback(async (id: string) => {
    await deleteChat.mutateAsync(id);
    if (id === activeChatId) setActiveChatId(null);
  }, [deleteChat, activeChatId]);

  const send = useCallback(async (text: string, mode: 'answer' | 'compare' | 'summarize' | 'checklist' | 'research' = 'answer', language: 'default' | 'en' | 'ja' = 'default', contextSource?: string) => {
    let chatId = activeChatId;
    if (!chatId) {
      const chat = await createChat.mutateAsync();
      chatId = chat.id;
      setActiveChatId(chatId);
    }
    await sendMessage.mutateAsync({ chatId, question: text, mode, language, contextSources: contextSource ? [contextSource] : [] });
  }, [activeChatId, createChat, sendMessage]);

  const submitFeedback = useCallback((messageId: string, kind: 'helpful' | 'not_helpful' | 'incorrect' | 'missing_source' | 'report_concern') => {
    feedback.mutate({ messageId, kind });
  }, [feedback]);

  const proposeAction = useCallback((question: string, message: { id: string; content: string; sources?: { source: string }[] }) => {
    createActionProposal.mutate({
      action_type: 'draft_follow_up',
      idempotency_key: `follow-up:${message.id}`,
      title: 'Draft follow-up from an answer',
      target: null,
      inputs: { question, answer: message.content },
      source_ids: (message.sources ?? []).map((source) => source.source),
      permission_scope: 'requester only until approved',
      expected_side_effects: ['No external write is performed by this proposal'],
    });
  }, [createActionProposal]);

  if (!user) return null;

  return (
    <ChatShell
      chats={chats}
      activeChatId={activeChatId}
      onSelectChat={selectChat}
      onNewChat={newChat}
      onDeleteChat={onDeleteChat}
      documents={documents}
      onUploadDocument={(file) => uploadDoc.mutate(file)}
      onDeleteDocument={(name) => deleteDoc.mutate(name)}
      canManageDocuments={isAdmin || role === 'knowledge_owner'}
    >
      <ChatMessages messages={messages} loading={sending} onSuggest={send} onFeedback={submitFeedback} onProposeAction={proposeAction} />
      <ChatInput onSend={send} disabled={sending} documents={Object.keys(documents)} initialValue={initialContext} />
    </ChatShell>
  );
}

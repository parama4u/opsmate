'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Input } from '@/components/ui/input';
import { useDeleteAllChats, useDeleteUserData } from '@/lib/query/hooks';
import { apiDownload } from '@/lib/api';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { user, isAdmin } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const deleteAll = useDeleteAllChats();
  const deleteData = useDeleteUserData();
  const [dataConfirmation, setDataConfirmation] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportStatus(null);
    try {
      await apiDownload('/api/users/me/export', 'orgchai-my-data.json');
      setExportStatus(t('exportSuccess'));
    } catch {
      setExportStatus(t('exportError'));
    } finally {
      setExporting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-8 space-y-4">
        <div>
          <label htmlFor="display-name" className="text-sm font-medium">{t('displayName')}</label>
          <Input id="display-name" className="mt-1" value={user.displayName || ''} disabled />
        </div>
        <div>
          <label htmlFor="account-email" className="text-sm font-medium">{t('email')}</label>
          <Input id="account-email" className="mt-1" value={user.email || ''} disabled />
        </div>
        <p className="text-sm text-muted-foreground">
          {t('admin')}: {isAdmin ? 'yes' : 'no'}
        </p>
        <section className="border p-4">
          <h2 className="font-semibold">{t('exportTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('exportDescription')}</p>
          <button type="button" className="mt-3 border px-3 py-2 text-sm hover:bg-muted" onClick={() => void handleExport()} disabled={exporting}>{exporting ? t('exportPending') : t('exportButton')}</button>
          {exportStatus ? <p role="status" className="mt-2 text-sm text-muted-foreground">{exportStatus}</p> : null}
        </section>
        <section className="border border-red-700 p-4">
          <h2 className="font-semibold">{t('deleteDataTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('deleteDataDescription')}</p>
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => {
            event.preventDefault();
            if (dataConfirmation !== 'DELETE MY DATA') return;
            deleteData.mutate(undefined, { onSettled: () => setDataConfirmation('') });
          }}>
            <Input value={dataConfirmation} onChange={(event) => setDataConfirmation(event.target.value)} placeholder={t('deleteDataConfirmation')} aria-label={t('deleteDataConfirmation')} />
            <button type="submit" disabled={dataConfirmation !== 'DELETE MY DATA' || deleteData.isPending} className="border border-red-700 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">{t('deleteDataButton')}</button>
          </form>
          {deleteData.isSuccess ? <p className="mt-2 text-sm text-muted-foreground">{t('deleteDataComplete')}</p> : null}
          {deleteData.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{t('deleteError')}</p> : null}
        </section>
        <section className="border p-4">
          <h2 className="font-semibold">{t('deleteChatsTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('deleteChatsDescription')}</p>
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => {
            event.preventDefault();
            if (confirmation !== 'DELETE') return;
            deleteAll.mutate(undefined, { onSettled: () => setConfirmation('') });
          }}>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={t('deleteChatsConfirmation')}
              aria-label={t('deleteChatsConfirmation')}
            />
            <button type="submit" disabled={confirmation !== 'DELETE' || deleteAll.isPending} className="border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {t('deleteChatsButton')}
            </button>
          </form>
          {deleteAll.isSuccess ? <p className="mt-2 text-sm text-muted-foreground">{t('deleteChatsComplete', { count: deleteAll.data.deleted })}</p> : null}
          {deleteAll.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{t('deleteError')}</p> : null}
        </section>
      </div>
    </div>
  );
}

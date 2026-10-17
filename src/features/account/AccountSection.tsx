import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Cloud, CloudOff, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { usePendingSyncCount, useSyncState } from '@/data/hooks';
import { authAvailable, useAuth } from '@/data/sync/auth';
import { signOutAndClear, syncNow } from '@/data/sync/syncEngine';
import { cn } from '@/shared/lib/cn';
import { formatTime } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { Button, Card, ListGroup, ListRow, SectionTitle, Sheet, useToast } from '@/shared/ui';
import { AuthSheet } from './AuthSheet';

/** Bloque de Ajustes: crear cuenta, estado de la sincronización y cerrar sesión. */
export function AccountSection() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { session } = useAuth();
  const sync = useSyncState();
  const pending = usePendingSyncCount() ?? 0;
  const [authOpen, setAuthOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  const [outBusy, setOutBusy] = useState(false);
  const [outError, setOutError] = useState(false);

  if (!authAvailable()) return null;

  const doSignOut = async () => {
    setOutBusy(true);
    const r = await signOutAndClear();
    setOutBusy(false);
    if (r === 'pending_offline') {
      tap('warning');
      return setOutError(true);
    }
    toast(t('account.signedOut'));
    setOutOpen(false);
  };

  const StatusIcon = sync.status === 'offline' ? CloudOff : sync.status === 'error' ? AlertTriangle : sync.status === 'syncing' ? RefreshCw : Cloud;

  return (
    <>
      <SectionTitle>{t('account.section')}</SectionTitle>
      {!session ? (
        <Card className="flex flex-col gap-4">
          <div className="flex gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-ink">{t('account.signedOutTitle')}</p>
              <p className="mt-1 text-[14px] leading-snug text-ink-2">{t('account.signedOutBody')}</p>
            </div>
          </div>
          <Button block onClick={() => setAuthOpen(true)}>
            {t('account.signIn')}
          </Button>
        </Card>
      ) : (
        <ListGroup>
          <ListRow
            icon={<StatusIcon className={cn(sync.status === 'syncing' && 'animate-spin')} />}
            title={t(`account.status.${sync.status}`)}
            subtitle={
              pending > 0
                ? t('account.pending', { count: pending })
                : sync.lastSyncedAt
                  ? t('account.lastSync', { time: formatTime(sync.lastSyncedAt, i18n.language) })
                  : t('account.signedIn', { email: session.user.email ?? '' })
            }
            trailing={
              <button
                type="button"
                aria-label={t('account.syncNow')}
                onClick={() => {
                  tap();
                  void syncNow();
                }}
                className="grid h-11 w-11 place-items-center rounded-full text-accent active:bg-accent-soft"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            }
          />
          <ListRow icon={<UserRound />} title={session.user.email ?? ''} />
          <ListRow icon={<LogOut />} title={t('account.signOut')} onClick={() => setOutOpen(true)} />
        </ListGroup>
      )}

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <Sheet
        open={outOpen}
        onClose={() => {
          setOutOpen(false);
          setOutError(false);
        }}
        title={t('account.signOutTitle')}
        description={t('account.signOutBody')}
        footer={
          <div className="flex flex-col gap-2.5">
            <Button variant="ink" size="lg" block loading={outBusy} onClick={doSignOut}>
              {t('account.signOutConfirm')}
            </Button>
            <Button variant="secondary" size="lg" block onClick={() => setOutOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        }
      >
        {outError ? <p className="rounded-2xl bg-warn/10 px-4 py-3 text-[14px] text-ink">{t('account.signOutPending')}</p> : <div />}
      </Sheet>
    </>
  );
}

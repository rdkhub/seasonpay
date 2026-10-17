import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/shared/lib/useOnline';

/** Aviso discreto cuando no hay señal (pasa seguido en la montaña). */
export function OfflinePill() {
  const online = useOnline();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <div className="mb-3 flex animate-fade-in items-center gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] font-medium text-ink-2">
      <CloudOff className="h-4 w-4 shrink-0" />
      {t('common.offline')}
    </div>
  );
}

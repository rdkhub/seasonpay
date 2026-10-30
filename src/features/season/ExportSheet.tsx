import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { deliverFiles } from '@/shared/lib/download';
import { track } from '@/data/telemetry';
import { tap } from '@/shared/lib/haptics';
import { Button, SegmentedControl, Sheet, useToast } from '@/shared/ui';
import { buildCsvFiles, buildPdf, gatherExport, type ExportRange } from './export/buildExport';

export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [range, setRange] = useState<ExportRange>('all');
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);

  const run = async (kind: 'pdf' | 'csv') => {
    setBusy(kind);
    try {
      const data = await gatherExport(range);
      if (!data.shifts.length && !data.paystubs.length && !data.savings.length) {
        toast(t('export.empty'), 'info');
        return;
      }
      const files = kind === 'pdf' ? [await buildPdf(data, t, i18n.language)] : buildCsvFiles(data);
      const res = await deliverFiles(files);
      if (res !== 'cancelled') {
        tap('success');
        toast(t('export.done'));
        void track('export_made', { kind });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('export.title')} description={t('season.exportBody')}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-medium text-ink-2">{t('export.range')}</span>
          <SegmentedControl
            ariaLabel={t('export.range')}
            value={range}
            onChange={setRange}
            options={[
              { value: 'all', label: t('export.all') },
              { value: 'thisYear', label: t('export.thisYear') },
            ]}
          />
        </div>
        <Button size="lg" block icon={<FileText className="h-5 w-5" />} loading={busy === 'pdf'} disabled={!!busy} onClick={() => run('pdf')}>
          {busy === 'pdf' ? t('export.making') : t('export.pdf')}
        </Button>
        <Button size="lg" variant="secondary" block icon={<FileSpreadsheet className="h-5 w-5" />} loading={busy === 'csv'} disabled={!!busy} onClick={() => run('csv')}>
          {busy === 'csv' ? t('export.making') : t('export.csv')}
        </Button>
      </div>
    </Sheet>
  );
}

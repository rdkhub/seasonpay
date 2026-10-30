import { useTranslation } from 'react-i18next';
import { ExternalLink, Scale } from 'lucide-react';
import type { TaxRuleRow } from '@/data/db';
import type { StateOvertime } from '@/data/repos/rules';
import { formatDateISO } from '@/shared/lib/format';
import { stateName } from '@/shared/lib/usStates';
import { cn } from '@/shared/lib/cn';

/**
 * Qué dice la ley de overtime del estado donde trabaja el usuario (regla overtime_state).
 * Siempre recuerda que la regla federal (40 h) aplica a empleadores cubiertos por la FLSA.
 */
export function StateOvertimeCard({ rules, state, className }: { rules: TaxRuleRow[]; state: string | null; className?: string }) {
  const { t, i18n } = useTranslation();
  if (!state) return null;
  const rule = rules.filter((r) => r.key === 'overtime_state' && r.jurisdiction === state).sort((a, b) => b.year - a.year)[0];
  if (!rule) return null;
  const v = rule.value as StateOvertime;
  const name = stateName(state);

  let summary: string;
  if (v.no_state_law) summary = t('stateOt.noStateLaw', { state: name });
  else if (v.excludes_flsa_covered) summary = t('stateOt.flsaExcluded', { state: name });
  else if (v.no_state_overtime) summary = t('stateOt.noOvertime', { state: name });
  else if (v.daily_hours && v.weekly_hours) summary = t('stateOt.dailyWeekly', { state: name, daily: v.daily_hours, weekly: v.weekly_hours });
  else summary = t('stateOt.weekly', { state: name, weekly: v.weekly_hours });

  const daily = !!v.daily_hours;
  return (
    <div className={cn('rounded-2xl p-4', daily ? 'bg-warn/10' : 'bg-surface-2', className)}>
      <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Scale className={cn('h-5 w-5', daily ? 'text-warn' : 'text-accent')} />
        {t('stateOt.title', { state: name })}
      </div>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{summary}</p>
      {(v.notes ?? []).map((n) => (
        <p key={n} className="mt-1.5 text-[14px] leading-snug text-ink-2">
          {t(`stateOt.notes.${n}`, { daily: v.daily_hours, dt: v.daily_double_time_hours, seasonal: v.seasonal_recreation_weekly_hours })}
        </p>
      ))}
      {daily && <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{v.daily_applies_to_all ? t('stateOt.appliedDaily', { daily: v.daily_hours }) : t('stateOt.manualDaily')}</p>}
      <p className="mt-1.5 text-[12px] leading-snug text-ink-3">{t('stateOt.federalNote')}</p>
      <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
        {t('common.source')}: {rule.sourceUrl.includes('dol.gov') ? 'U.S. DOL' : t('stateOt.stateSource', { state: name })} <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <p className="mt-0.5 text-[12px] text-ink-3">{t('common.verifiedOn', { date: formatDateISO(rule.verifiedAt, i18n.language) })}</p>
    </div>
  );
}

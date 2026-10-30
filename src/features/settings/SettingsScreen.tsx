import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, BookOpenCheck, Briefcase, FileJson, Lock, MessageCircle, MessageSquareHeart, Plus, ScrollText, Share2, ShieldCheck, Smartphone, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EmployerRow, LanguagePref } from '@/data/db';
import { useAppConfig, useEmployers, useProfile, useRules } from '@/data/hooks';
import { buildMyDataExport, myDataFile } from '@/data/exportAll';
import { useAuth } from '@/data/sync/auth';
import { checkIsAdmin } from '@/features/admin/adminApi';
import { openFeedback } from '@/features/feedback/feedbackStore';
import { InstallSheet } from '@/features/install/InstallSheet';
import { installCase } from '@/features/install/installGuide';
import { deliverFiles } from '@/shared/lib/download';
import { track } from '@/data/telemetry';
import { deleteAllMyData } from '@/data/repos/account';
import { saveProfile } from '@/data/repos/profile';
import { formatMoney } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { stateName } from '@/shared/lib/usStates';
import { Badge, Button, Card, EmptyState, ListGroup, ListRow, SectionTitle, SegmentedControl, Sheet, Toggle, useToast } from '@/shared/ui';
import { AccountSection } from '@/features/account/AccountSection';
import { EmployerSheet } from './EmployerSheet';
import { ProfileSheet } from './ProfileSheet';
import { RulesSheet } from './RulesSheet';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const profile = useProfile();
  const employers = useEmployers(true);
  const rules = useRules();
  const config = useAppConfig();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const installed = installCase() === 'installed';

  useEffect(() => {
    if (session) void checkIsAdmin().then(setIsAdmin);
    else setIsAdmin(false);
  }, [session]);

  const exportJson = async () => {
    setExporting(true);
    try {
      const r = await deliverFiles([myDataFile(await buildMyDataExport())]);
      if (r !== 'cancelled') {
        toast(t('export.done'));
        void track('export_made', { kind: 'json' });
      }
    } finally {
      setExporting(false);
    }
  };

  const [employerSheet, setEmployerSheet] = useState<{ open: boolean; employer: EmployerRow | null }>({ open: false, employer: null });
  const [profileOpen, setProfileOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lang = profile?.language ?? 'system';
  const setLang = (v: LanguagePref) => void saveProfile({ language: v });

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAllMyData();
      tap('success');
      toast(t('settings.deleted'));
      setDeleteOpen(false);
      // Sin perfil, el router manda a la bienvenida.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <header className="mb-5 flex items-center justify-between gap-3 px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink">{t('settings.title')}</h1>
        <Badge tone="accent">{t('pilot.beta')}</Badge>
      </header>

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <SegmentedControl
        ariaLabel={t('settings.language')}
        value={lang}
        onChange={setLang}
        options={[
          { value: 'system', label: t('settings.system') },
          { value: 'es', label: 'Español' },
          { value: 'en', label: 'English' },
        ]}
      />

      <AccountSection />

      <SectionTitle>{t('settings.profile')}</SectionTitle>
      <ListGroup>
        <ListRow
          icon={<UserRound />}
          title={profile?.visaType ? t(`visa.${profile.visaType}`) : '—'}
          subtitle={[stateName(profile?.workState), profile?.arrivalYear].filter(Boolean).join(' · ')}
          onClick={() => setProfileOpen(true)}
        />
      </ListGroup>

      <SectionTitle
        action={
          employers && employers.length > 0 ? (
            <button
              type="button"
              onClick={() => setEmployerSheet({ open: true, employer: null })}
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-accent active:bg-accent-soft"
            >
              <Plus className="h-4 w-4" /> {t('common.add')}
            </button>
          ) : undefined
        }
      >
        {t('settings.employers')}
      </SectionTitle>
      {employers && employers.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title={t('settings.noEmployers')}
          action={
            <Button block onClick={() => setEmployerSheet({ open: true, employer: null })}>
              {t('settings.addEmployer')}
            </Button>
          }
        />
      ) : (
        <ListGroup>
          {(employers ?? []).map((e) => (
            <ListRow
              key={e.id}
              icon={<Briefcase />}
              title={e.name}
              subtitle={`${t(`payFrequency.${e.payFrequency}`)}${e.overtimeEnabled ? ` · OT ${e.overtimeDailyHours ? `${e.overtimeDailyHours} h/${t('employer.dayShort')} · ` : ''}${e.overtimeThresholdHours} h · ${e.overtimeMultiplier}x` : ''}`}
              trailing={
                e.archived ? (
                  <Badge>{t('employer.archived')}</Badge>
                ) : (
                  <span className="tnum font-semibold text-ink">
                    {formatMoney(e.hourlyRateCents, i18n.language)}
                    <span className="font-normal text-ink-3">{t('common.perHour')}</span>
                  </span>
                )
              }
              onClick={() => setEmployerSheet({ open: true, employer: e })}
            />
          ))}
        </ListGroup>
      )}

      <SectionTitle>{t('settings.sources')}</SectionTitle>
      <ListGroup>
        <ListRow icon={<BookOpenCheck />} title={t('settings.sources')} subtitle={t('settings.sourcesSub')} onClick={() => setRulesOpen(true)} />
      </ListGroup>

      <SectionTitle>{t('pilot.section')}</SectionTitle>
      <ListGroup>
        <ListRow icon={<MessageSquareHeart />} title={t('feedback.title')} subtitle={t('feedback.rowSub')} onClick={() => void openFeedback()} />
        {config.whatsappGroupUrl && <ListRow icon={<MessageCircle />} title={t('feedback.whatsapp')} subtitle={t('feedback.whatsappSub')} href={config.whatsappGroupUrl} />}
        {!installed && <ListRow icon={<Smartphone />} title={t('install.title')} subtitle={t('install.rowSub')} onClick={() => setInstallOpen(true)} />}
        <ListRow
          icon={<Share2 />}
          title={t('settings.share')}
          subtitle={t('settings.shareSub')}
          onClick={async () => {
            const url = `${window.location.origin}/hola`;
            const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
            try {
              if (nav.share) await nav.share({ title: 'SeasonPay', text: t('settings.shareText'), url });
              else {
                await navigator.clipboard.writeText(url);
                toast(t('settings.linkCopied'));
              }
            } catch {
              /* el usuario canceló */
            }
          }}
        />
      </ListGroup>

      <SectionTitle>{t('settings.privacy')}</SectionTitle>
      <Card className="flex gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Lock className="h-5 w-5" />
        </span>
        <p className="text-[14px] leading-snug text-ink-2">{t('settings.privacyBody')}</p>
      </Card>
      <div className="mt-3">
        <ListGroup>
          <ListRow icon={<ScrollText />} title={t('privacyPolicy.title')} onClick={() => navigate('/privacidad')} />
          <ListRow icon={<FileJson />} title={t('settings.exportMine')} subtitle={exporting ? t('export.making') : t('settings.exportMineSub')} onClick={() => void exportJson()} />
        </ListGroup>
      </div>
      <Card className="mt-3">
        <Toggle
          checked={!(profile?.analyticsOptOut ?? false)}
          onChange={(on) => void saveProfile({ analyticsOptOut: !on })}
          label={t('settings.metrics')}
          description={t('settings.metricsSub')}
        />
      </Card>

      <SectionTitle>{t('settings.danger')}</SectionTitle>
      <ListGroup>
        <ListRow icon={<Trash2 />} tone="danger" title={t('settings.deleteAll')} subtitle={t('settings.deleteAllSub')} onClick={() => setDeleteOpen(true)} />
      </ListGroup>

      {isAdmin && (
        <>
          <SectionTitle>{t('admin.title')}</SectionTitle>
          <ListGroup>
            <ListRow icon={<BarChart3 />} title={t('admin.open')} subtitle={t('admin.openSub')} onClick={() => navigate('/admin')} />
          </ListGroup>
        </>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-3">
        <ShieldCheck className="h-3.5 w-3.5" /> SeasonPay · {t('pilot.beta')} · {t('settings.version', { v: __APP_VERSION__ })}
      </p>

      <EmployerSheet open={employerSheet.open} employer={employerSheet.employer} onClose={() => setEmployerSheet((s) => ({ ...s, open: false }))} />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} profile={profile ?? null} />
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} rules={rules ?? []} state={profile?.workState ?? null} />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('settings.deleteTitle')}
        description={t('settings.deleteBody')}
        footer={
          <div className="flex flex-col gap-2.5">
            <Button variant="danger" size="lg" block icon={<Trash2 className="h-5 w-5" />} onClick={doDelete} loading={deleting}>
              {t('settings.deleteConfirm')}
            </Button>
            <Button variant="secondary" size="lg" block onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        }
      >
        <div />
      </Sheet>
    </div>
  );
}

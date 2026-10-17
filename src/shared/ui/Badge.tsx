import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type Tone = 'neutral' | 'accent' | 'positive' | 'warn' | 'inverse';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  accent: 'bg-accent-soft text-accent',
  positive: 'bg-positive/10 text-positive',
  warn: 'bg-warn/15 text-warn',
  inverse: 'bg-white/15 text-white',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold tracking-[0.01em]', tones[tone], className)}>
      {children}
    </span>
  );
}

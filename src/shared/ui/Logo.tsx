import { cn } from '@/shared/lib/cn';

/** Marca de SeasonPay: montaña con una línea de pago que sube. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-12 w-12', className)} aria-hidden>
      <defs>
        <linearGradient id="sp-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#123A7A" />
          <stop offset="0.6" stopColor="#1C5FCF" />
          <stop offset="1" stopColor="#4A93F5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#sp-g)" />
      <path d="M10 46 L25 24 L33 35 L39 28 L54 46 Z" fill="#FFFFFF" fillOpacity="0.95" />
      <path d="M25 24 L29.5 30.5 L27 33 L24 30 L21 31.5 Z" fill="#1C5FCF" fillOpacity="0.35" />
      <circle cx="47" cy="17" r="4.5" fill="#BFE0FF" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-9 w-9" />
      <span className="text-[19px] font-semibold tracking-[-0.02em] text-ink">SeasonPay</span>
    </span>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Acciones fijas abajo (zona del pulgar) */
  footer?: ReactNode;
}

const EXIT_MS = 200;

/**
 * Hoja que sube desde abajo. Se cierra tocando el fondo, con Escape o
 * arrastrando hacia abajo desde el encabezado.
 */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      setDragY(0);
    } else if (mounted) {
      setLeaving(true);
      const id = window.setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, EXIT_MS);
      return () => window.clearTimeout(id);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 30);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [mounted]);

  if (!mounted) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > 110) onClose();
    else setDragY(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <div
        className={cn('absolute inset-0 bg-[rgb(5_10_20/0.45)] backdrop-blur-[2px] transition-opacity duration-200', leaving ? 'opacity-0' : 'animate-fade-in')}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-surface shadow-lift outline-none',
          leaving ? 'translate-y-full transition-transform duration-200 ease-in' : 'animate-sheet-in',
          dragStart.current === null && !leaving && 'transition-transform duration-200 ease-out',
        )}
        style={dragY && !leaving ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="touch-none cursor-grab px-5 pb-2 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
          {(title || description) && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {title && <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h2>}
                {description && <p className="mt-1 text-[15px] leading-snug text-ink-2">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={t('common.close')}
                className="-mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">{children}</div>
        {footer && <div className="border-t border-line/70 bg-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}

import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses('glass-panel rounded-2xl border border-border/80 p-5', className)} {...props} />;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl space-y-2">
        {eyebrow ? <div className="text-xs uppercase tracking-[0.32em] text-muted">{eyebrow}</div> : null}
        <h2 className="text-2xl font-semibold tracking-tight text-text md:text-[2rem]">{title}</h2>
        {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PulseLoader({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const dimensions = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6';
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2';

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`relative inline-flex items-center justify-center ${dimensions}`} aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-primary/35" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className={`${dotSize} rounded-full bg-primary/90`} />
      </span>
      {label ? <span className="text-sm text-slate-300">{label}</span> : null}
    </div>
  );
}

export function PageLoader({ message = 'Processing...' }: { message?: string }) {
  return (
    <div className="flex min-h-[14rem] items-center justify-center rounded-2xl border border-border bg-black/30 p-8">
      <PulseLoader size="lg" label={message} />
    </div>
  );
}

export function Button({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'accent'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-3 text-base'
  };
  const styles = {
    primary: 'bg-primary text-white shadow-glow hover:-translate-y-0.5 hover:shadow-soft',
    ghost: 'bg-white/5 text-text hover:bg-white/10',
    outline: 'border border-border bg-transparent text-text hover:bg-white/5',
    accent: 'bg-warning/20 text-warning border border-warning/40 hover:bg-warning/30'
  };
  return (
    <button className={joinClasses(base, sizes[size], styles[variant], className)} disabled={disabled || loading} {...props}>
      {loading ? <PulseLoader size="sm" /> : null}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'success' | 'danger' | 'warning' }) {
  const tones = {
    default: 'bg-white/8 text-slate-200',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
    warning: 'bg-warning/15 text-warning'
  };
  return <span className={joinClasses('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={joinClasses('w-full rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-text placeholder:text-slate-500 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10', className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={joinClasses('w-full rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-text placeholder:text-slate-500 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10', className)} {...props} />;
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={joinClasses('skeleton rounded-2xl', className)} />;
}

export function MetricPill({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'danger' | 'warning' }) {
  return (
    <div className="rounded-2xl border border-border bg-white/5 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-muted">{label}</div>
      <div className={joinClasses('mt-1 text-lg font-semibold', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-text')}>
        {value}
      </div>
    </div>
  );
}

import { cn } from '@/lib/cn';

type Props = {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClass = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function Avatar({ src, name, size = 'md', className }: Props) {
  const cls = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700',
    sizeClass[size],
    className,
  );

  if (src) {
    return <img src={src} alt={name ?? 'avatar'} className={cls} />;
  }
  return <span className={cls}>{initials(name).toUpperCase() || '?'}</span>;
}

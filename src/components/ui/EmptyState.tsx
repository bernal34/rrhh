import { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className = '' }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-soft ring-1 ring-slate-200">
        <Icon size={22} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

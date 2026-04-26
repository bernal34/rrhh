import { LucideIcon } from 'lucide-react';
import { getToneFor } from '@/lib/moduloColors';

type Props = {
  modulo?: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({ modulo, icon: Icon, title, subtitle, actions }: Props) {
  const tone = getToneFor(modulo);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg ${tone.headerBg} ${tone.headerBorder} px-4 py-3`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-soft ${tone.iconActive}`}>
            <Icon size={18} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

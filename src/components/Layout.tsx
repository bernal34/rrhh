import { NavLink } from 'react-router-dom';
import {
  Users,
  CalendarClock,
  DollarSign,
  FileText,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Clock,
  AlertCircle,
  Gavel,
  Building2,
  Briefcase,
  ShieldCheck,
  Palmtree,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, modulo: null },
  { to: '/empleados', label: 'Empleados', icon: Users, modulo: 'empleados' },
  { to: '/sucursales', label: 'Sucursales / Obras', icon: Building2, modulo: 'sucursales' },
  { to: '/puestos', label: 'Puestos', icon: Briefcase, modulo: 'puestos' },
  { to: '/horarios', label: 'Horarios', icon: Clock, modulo: 'horarios' },
  { to: '/asistencia', label: 'Asistencia', icon: CalendarClock, modulo: 'asistencia' },
  { to: '/incidencias', label: 'Incidencias', icon: AlertCircle, modulo: 'incidencias' },
  { to: '/vacaciones', label: 'Vacaciones', icon: Palmtree, modulo: 'vacaciones' },
  { to: '/actas', label: 'Actas', icon: Gavel, modulo: 'actas' },
  { to: '/nomina', label: 'Nómina', icon: DollarSign, modulo: 'nomina' },
  { to: '/documentos', label: 'Documentos', icon: FileText, modulo: 'documentos' },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, modulo: 'reportes' },
  { to: '/usuarios', label: 'Usuarios', icon: ShieldCheck, modulo: 'usuarios' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, rol, signOut, puedeVer } = useAuth();
  const visibles = nav.filter((n) => n.modulo === null || puedeVer(n.modulo));

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-4 text-lg font-semibold text-brand-700">Portal RRHH</div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {visibles.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-sm">
          <div className="mb-2">
            <div className="truncate font-medium text-slate-700">{user?.email}</div>
            <div className="text-xs text-slate-500">{rol ?? 'sin rol'}</div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

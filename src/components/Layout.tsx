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
  Calculator,
  Calendar,
  GraduationCap,
  ClipboardCheck,
  Network,
  Activity,
  Bell,
  Heart,
  HandCoins,
  UserCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import GlobalSearch from './GlobalSearch';
import { getToneFor } from '@/lib/moduloColors';

type EmpresaHdr = { razon_social: string; logo_url: string | null };

function useEmpresaHeader() {
  const [emp, setEmp] = useState<EmpresaHdr | null>(null);
  useEffect(() => {
    (async () => {
      try {
        // Prioriza la empresa marcada como principal
        const { data: principal } = await supabase
          .from('empresas')
          .select('razon_social, logo_url')
          .eq('activo', true)
          .eq('principal', true)
          .maybeSingle();
        if (principal) {
          setEmp(principal as EmpresaHdr);
          return;
        }
        // Fallback: primera alfabética
        const { data } = await supabase
          .from('empresas')
          .select('razon_social, logo_url')
          .eq('activo', true)
          .order('razon_social')
          .limit(1)
          .maybeSingle();
        setEmp((data as EmpresaHdr | null) ?? null);
      } catch {
        setEmp(null);
      }
    })();
  }, []);
  return emp;
}

type NavItem = { to: string; label: string; icon: typeof Users; modulo: string | null };
type NavGroup = { title: string | null; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, modulo: null },
      { to: '/mi-portal', label: 'Mi portal', icon: UserCircle, modulo: null },
    ],
  },
  {
    title: 'Operación',
    items: [
      { to: '/empleados', label: 'Empleados', icon: Users, modulo: 'empleados' },
      { to: '/asistencia', label: 'Asistencia', icon: CalendarClock, modulo: 'asistencia' },
      { to: '/incidencias', label: 'Incidencias', icon: AlertCircle, modulo: 'incidencias' },
      { to: '/vacaciones', label: 'Vacaciones', icon: Palmtree, modulo: 'vacaciones' },
      { to: '/calendario', label: 'Calendario', icon: Calendar, modulo: 'calendario' },
      { to: '/actas', label: 'Actas', icon: Gavel, modulo: 'actas' },
      { to: '/notificaciones', label: 'Notificaciones', icon: Bell, modulo: 'notificaciones' },
    ],
  },
  {
    title: 'Procesos',
    items: [
      { to: '/onboarding', label: 'Onboarding', icon: ClipboardCheck, modulo: 'onboarding' },
      { to: '/capacitacion', label: 'Capacitación', icon: GraduationCap, modulo: 'capacitacion' },
      { to: '/horarios', label: 'Horarios', icon: Clock, modulo: 'horarios' },
      { to: '/nom035', label: 'NOM-035', icon: Heart, modulo: 'nom035' },
    ],
  },
  {
    title: 'Nómina',
    items: [
      { to: '/nomina', label: 'Nómina', icon: DollarSign, modulo: 'nomina' },
      { to: '/calculadoras', label: 'Calculadoras', icon: Calculator, modulo: 'calculadoras' },
      { to: '/prestamos', label: 'Préstamos', icon: HandCoins, modulo: 'prestamos' },
      { to: '/documentos', label: 'Documentos', icon: FileText, modulo: 'documentos' },
      { to: '/reportes', label: 'Reportes', icon: BarChart3, modulo: 'reportes' },
    ],
  },
  {
    title: 'Catálogos',
    items: [
      { to: '/empresas', label: 'Empresas', icon: Building2, modulo: 'empresas' },
      { to: '/sucursales', label: 'Sucursales / Obras', icon: Building2, modulo: 'sucursales' },
      { to: '/puestos', label: 'Puestos', icon: Briefcase, modulo: 'puestos' },
      { to: '/organigrama', label: 'Organigrama', icon: Network, modulo: 'organigrama' },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: ShieldCheck, modulo: 'usuarios' },
      { to: '/auditoria', label: 'Auditoría', icon: Activity, modulo: 'auditoria' },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, rol, signOut, puedeVer } = useAuth();
  const empresa = useEmpresaHeader();

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((n) => n.modulo === null || puedeVer(n.modulo)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
              <Users size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 leading-tight">Portal RRHH</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Gestión de personal
              </div>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
          {visibleGroups.map((g, gi) => (
            <div key={gi}>
              {g.title && (
                <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.title}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {g.items.map(({ to, label, icon: Icon, modulo }) => {
                  const tone = getToneFor(modulo);
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) =>
                        clsx(
                          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive
                            ? `${tone.activeBg} ${tone.activeText} font-medium`
                            : `text-slate-600 ${tone.hoverBg} hover:text-slate-900`,
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={16} className={isActive ? tone.iconActive : tone.icon} />
                          {label}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-700">{user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {rol ?? 'sin rol'}
              </div>
            </div>
            <button
              onClick={signOut}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.razon_social}
                className="h-9 max-w-[180px] object-contain"
              />
            ) : (
              <div className="flex h-9 items-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-xs text-slate-400">
                Sube el logo en Empresas
              </div>
            )}
            {empresa?.razon_social && (
              <div className="hidden text-sm font-semibold text-slate-700 md:block">
                {empresa.razon_social}
              </div>
            )}
          </div>
          <GlobalSearch />
        </header>
        <div className="flex-1 overflow-auto p-6 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

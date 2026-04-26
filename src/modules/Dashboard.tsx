import { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  HelpCircle,
  Cake,
  Award,
  AlertTriangle,
  Palmtree,
} from 'lucide-react';
import { DashboardData, loadDashboard } from '@/services/dashboardService';

const MES_LABEL = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date());

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">Cargando…</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Vista general de tu organización · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={<Users size={18} />} title="Empleados activos" value={String(data.empleadosActivos)} tone="brand" />
        <KpiCard icon={<CheckCircle size={18} />} title="Puntuales hoy" value={String(data.asistenciaHoy.puntual)} tone="green" />
        <KpiCard icon={<Clock size={18} />} title="Retardos hoy" value={String(data.asistenciaHoy.retardo)} tone="yellow" />
        <KpiCard icon={<XCircle size={18} />} title="Faltas hoy" value={String(data.asistenciaHoy.falta)} tone="red" />
        <KpiCard icon={<HelpCircle size={18} />} title="Pendientes hoy" value={String(data.asistenciaHoy.pendiente)} tone="blue" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          icon={<Cake size={18} className="text-pink-600" />}
          title={`Cumpleaños de ${MES_LABEL}`}
          empty="Nadie cumple este mes."
        >
          {data.cumpleanos.map((c) => (
            <Row
              key={c.id}
              left={<span className="font-medium text-slate-800">{c.nombre}</span>}
              right={
                <span className="text-sm text-slate-500">
                  {c.dia} de {MES_LABEL}
                </span>
              }
            />
          ))}
        </Panel>

        <Panel
          icon={<Award size={18} className="text-purple-600" />}
          title={`Aniversarios laborales de ${MES_LABEL}`}
          empty="Sin aniversarios este mes."
        >
          {data.aniversarios.map((a) => (
            <Row
              key={a.id}
              left={<span className="font-medium text-slate-800">{a.nombre}</span>}
              right={
                <span className="text-sm text-slate-500">
                  Día {a.dia} ·{' '}
                  <b className="text-slate-700">
                    {a.anios} {a.anios === 1 ? 'año' : 'años'}
                  </b>
                </span>
              }
            />
          ))}
        </Panel>

        <Panel
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          title="Documentos por vencer (próx. 30 días)"
          empty="Ningún documento vence pronto."
        >
          {data.docsPorVencer.map((d) => (
            <Row
              key={d.id}
              left={
                <div>
                  <div className="font-medium text-slate-800">
                    {d.tipo} — {d.empleado_nombre}
                  </div>
                  <div className="text-xs text-slate-500">{d.nombre}</div>
                </div>
              }
              right={
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.dias_restantes <= 7
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {d.dias_restantes}d
                </span>
              }
            />
          ))}
        </Panel>

        <Panel
          icon={<Palmtree size={18} className="text-green-600" />}
          title="Vacaciones acumuladas (≥ 15 días)"
          empty="Nadie tiene saldo acumulado alto."
        >
          {data.vacacionesAlertas.map((v) => (
            <Row
              key={v.empleado_id}
              left={<span className="font-medium text-slate-800">{v.nombre}</span>}
              right={
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 tabular-nums">
                  {v.dias_disponibles} días
                </span>
              }
            />
          ))}
        </Panel>
      </section>
    </div>
  );
}

type Tone = 'brand' | 'green' | 'yellow' | 'red' | 'blue';

const toneClasses: Record<Tone, { bg: string; icon: string; value: string }> = {
  brand:  { bg: 'bg-brand-50',  icon: 'text-brand-600',  value: 'text-slate-900' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  value: 'text-slate-900' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', value: 'text-slate-900' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-600',    value: 'text-slate-900' },
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-slate-900' },
};

function KpiCard({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: string; tone: Tone }) {
  const c = toneClasses[tone];
  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition-all hover:shadow-card hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</div>
          <div className={`mt-2 text-3xl font-bold tabular-nums ${c.value}`}>{value}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg} ${c.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = !arr || arr.length === 0 || arr.every((c) => c === false || c == null);
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        {icon}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {isEmpty ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">{empty}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0">{left}</div>
      <div className="ml-3 shrink-0">{right}</div>
    </div>
  );
}

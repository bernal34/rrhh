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
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={<Users size={20} />}
          title="Empleados activos"
          value={String(data.empleadosActivos)}
          color="text-brand-700"
        />
        <KpiCard
          icon={<CheckCircle size={20} />}
          title="Puntuales hoy"
          value={String(data.asistenciaHoy.puntual)}
          color="text-green-700"
        />
        <KpiCard
          icon={<Clock size={20} />}
          title="Retardos hoy"
          value={String(data.asistenciaHoy.retardo)}
          color="text-yellow-700"
        />
        <KpiCard
          icon={<XCircle size={20} />}
          title="Faltas hoy"
          value={String(data.asistenciaHoy.falta)}
          color="text-red-700"
        />
        <KpiCard
          icon={<HelpCircle size={20} />}
          title="Pendientes hoy"
          value={String(data.asistenciaHoy.pendiente)}
          color="text-blue-700"
        />
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

function KpiCard({
  icon,
  title,
  value,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm">{title}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
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
    <div className="rounded-lg border border-slate-200 bg-white">
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

import { useEffect, useState } from 'react';
import { Bell, Calendar, FileWarning, Palmtree, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Alerta = {
  tipo: 'documento_vence' | 'cumpleanos' | 'incidencia_pendiente' | 'vacaciones_excesivas';
  ref_id: string;
  empleado_id: string;
  empleado_nombre: string;
  titulo: string;
  fecha: string | null;
  dias: number | null;
  severidad: 'critico' | 'alto' | 'medio' | 'bajo';
};

const sevColor: Record<string, string> = {
  critico: 'border-red-300 bg-red-50',
  alto: 'border-orange-300 bg-orange-50',
  medio: 'border-yellow-300 bg-yellow-50',
  bajo: 'border-slate-200 bg-white',
};

const sevBadge: Record<string, string> = {
  critico: 'bg-red-100 text-red-700',
  alto: 'bg-orange-100 text-orange-700',
  medio: 'bg-yellow-100 text-yellow-700',
  bajo: 'bg-slate-100 text-slate-600',
};

const tipoIcon: Record<string, React.ReactNode> = {
  documento_vence: <FileWarning size={16} className="text-amber-600" />,
  cumpleanos: <Calendar size={16} className="text-pink-600" />,
  incidencia_pendiente: <AlertCircle size={16} className="text-blue-600" />,
  vacaciones_excesivas: <Palmtree size={16} className="text-green-600" />,
};

const tipoLabel: Record<string, string> = {
  documento_vence: 'Documento por vencer',
  cumpleanos: 'Cumpleaños',
  incidencia_pendiente: 'Incidencia pendiente',
  vacaciones_excesivas: 'Vacaciones acumuladas',
};

export default function NotificacionesPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    supabase
      .from('alertas_pendientes')
      .select('*')
      .then(({ data }) => {
        const ord = (data ?? []) as Alerta[];
        const sevWeight: Record<string, number> = { critico: 0, alto: 1, medio: 2, bajo: 3 };
        ord.sort(
          (a, b) =>
            sevWeight[a.severidad] - sevWeight[b.severidad] ||
            (a.dias ?? 999) - (b.dias ?? 999),
        );
        setAlertas(ord);
        setLoading(false);
      });
  }, []);

  const filtradas = filtroTipo ? alertas.filter((a) => a.tipo === filtroTipo) : alertas;
  const counts = alertas.reduce(
    (a, x) => {
      a[x.tipo] = (a[x.tipo] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bell className="text-brand-600" /> Notificaciones
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {alertas.length} alertas pendientes que requieren atención.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip
          active={!filtroTipo}
          onClick={() => setFiltroTipo('')}
          label={`Todas (${alertas.length})`}
        />
        {Object.entries(counts).map(([t, n]) => (
          <Chip
            key={t}
            active={filtroTipo === t}
            onClick={() => setFiltroTipo(t)}
            label={`${tipoLabel[t]} (${n})`}
          />
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Cargando…</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center text-slate-500 py-12 rounded-lg border border-dashed border-slate-300 bg-white">
          🎉 No hay alertas pendientes.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtradas.map((a, i) => (
            <div
              key={`${a.tipo}-${a.ref_id}-${i}`}
              className={`flex items-start gap-3 rounded-lg border p-3 ${sevColor[a.severidad]}`}
            >
              <div className="mt-0.5">{tipoIcon[a.tipo]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{a.titulo}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sevBadge[a.severidad]}`}
                  >
                    {a.severidad}
                  </span>
                </div>
                <div className="text-sm text-slate-600">{a.empleado_nombre}</div>
                {a.fecha && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {a.fecha}
                    {a.dias !== null && a.dias !== undefined ? (
                      a.tipo === 'vacaciones_excesivas'
                        ? ` · ${a.dias} días acumulados`
                        : a.dias < 0
                          ? ` · vencido hace ${Math.abs(a.dias)} días`
                          : ` · en ${a.dias} días`
                    ) : ''}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

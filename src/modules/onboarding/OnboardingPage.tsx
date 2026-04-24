import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, UserCheck, UserMinus } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth';
import {
  ChecklistItem,
  EstadoItem,
  listEstados,
  listItems,
  setEstado,
} from '@/services/checklistService';
import { Empleado, listEmpleados } from '@/services/empleadosService';

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Onboarding / Offboarding</h1>
      <Tabs
        tabs={[
          {
            key: 'on',
            label: 'Onboarding',
            content: <ChecklistPanel flujo="onboarding" icono={<UserCheck />} />,
          },
          {
            key: 'off',
            label: 'Offboarding',
            content: <ChecklistPanel flujo="offboarding" icono={<UserMinus />} />,
          },
        ]}
      />
    </div>
  );
}

function ChecklistPanel({
  flujo,
  icono,
}: {
  flujo: 'onboarding' | 'offboarding';
  icono: React.ReactNode;
}) {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('onboarding');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [estados, setEstados] = useState<EstadoItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listItems(flujo).then(setItems);
    listEmpleados({
      estatus: flujo === 'offboarding' ? 'baja' : 'activo',
    }).then(setEmpleados);
  }, [flujo]);

  useEffect(() => {
    if (!empleadoId) {
      setEstados([]);
      return;
    }
    setLoading(true);
    listEstados(empleadoId)
      .then(setEstados)
      .finally(() => setLoading(false));
  }, [empleadoId]);

  async function toggle(itemId: string, cumplido: boolean) {
    await setEstado(empleadoId, itemId, cumplido);
    setEstados(await listEstados(empleadoId));
  }

  const completados = estados.filter((e) => e.cumplido).length;
  const total = items.length;
  const pct = total ? Math.round((completados / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Select
          label="Empleado"
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
          }))}
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
        />
      </div>

      {empleadoId && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                {icono} Progreso
              </span>
              <span className="tabular-nums text-slate-600">
                {completados}/{total} ({pct}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cumplido</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                )}
                {items.map((it) => {
                  const e = estados.find((x) => x.item_id === it.id);
                  const cumplido = e?.cumplido ?? false;
                  return (
                    <tr key={it.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <button
                          disabled={!editar}
                          onClick={() => editar && toggle(it.id, !cumplido)}
                          className={`text-${cumplido ? 'green' : 'slate'}-${cumplido ? '600' : '400'} disabled:cursor-not-allowed`}
                          title={cumplido ? 'Desmarcar' : 'Marcar como cumplido'}
                        >
                          {cumplido ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className={`font-medium ${cumplido ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {it.titulo}
                        </div>
                        {it.descripcion && (
                          <div className="text-xs text-slate-500">{it.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {it.obligatorio ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Obligatorio
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            Opcional
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {e?.cumplido_at
                          ? new Date(e.cumplido_at).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!empleadoId && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Selecciona un empleado para ver y marcar su checklist.
        </div>
      )}
    </div>
  );
}

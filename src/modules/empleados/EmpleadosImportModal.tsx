import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Plan, ResolvedRow, applyPlan } from '@/services/hccImportService';

type Props = {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  onApplied: () => void;
};

export default function EmpleadosImportModal({ open, onClose, plan, onApplied }: Props) {
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<{
    creados: number;
    actualizados: number;
    sucursales_creadas: number;
    puestos_creados: number;
    errores: Array<{ codigo: string; nombre: string; error: string }>;
  } | null>(null);

  async function aplicar() {
    if (!plan) return;
    setAplicando(true);
    try {
      const res = await applyPlan(plan);
      setResultado(res);
      onApplied();
    } catch (e) {
      alert(`Error al aplicar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setAplicando(false);
    }
  }

  function cerrar() {
    setResultado(null);
    onClose();
  }

  if (!plan) return null;

  return (
    <Modal open={open} onClose={cerrar} title="Importar empleados desde Excel HCC" size="xl">
      {resultado ? (
        <div className="space-y-4">
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <h3 className="font-semibold text-green-900">Import completado</h3>
            <ul className="mt-2 text-sm text-green-800">
              <li>Empleados creados: <b>{resultado.creados}</b></li>
              <li>Empleados actualizados: <b>{resultado.actualizados}</b></li>
              <li>Sucursales creadas: <b>{resultado.sucursales_creadas}</b></li>
              <li>Puestos creados: <b>{resultado.puestos_creados}</b></li>
              <li>Errores: <b>{resultado.errores.length}</b></li>
            </ul>
          </div>
          {resultado.errores.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <h4 className="font-semibold text-red-900">Errores</h4>
              <ul className="mt-2 max-h-48 overflow-auto text-xs text-red-800">
                {resultado.errores.map((e, i) => (
                  <li key={i}>
                    <b>{e.codigo}</b> {e.nombre}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={cerrar}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" valor={plan.resumen.total} />
            <Stat label="A crear" valor={plan.resumen.a_crear} color="text-emerald-700" />
            <Stat label="A actualizar" valor={plan.resumen.a_actualizar} color="text-blue-700" />
            <Stat label="Omitidos" valor={plan.resumen.omitidos} color="text-amber-700" />
          </div>

          {(plan.resumen.sucursales_faltantes.length > 0 ||
            plan.resumen.puestos_faltantes.length > 0) && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
              <div className="font-semibold text-blue-900">
                Catálogos que se crearán automáticamente
              </div>
              <ul className="mt-2 space-y-1 text-blue-800">
                {plan.resumen.sucursales_faltantes.length > 0 && (
                  <li>
                    <b>Sucursales ({plan.resumen.sucursales_faltantes.length}):</b>{' '}
                    {plan.resumen.sucursales_faltantes.join(', ')}
                  </li>
                )}
                {plan.resumen.puestos_faltantes.length > 0 && (
                  <li>
                    <b>Puestos ({plan.resumen.puestos_faltantes.length}):</b>{' '}
                    {plan.resumen.puestos_faltantes.join(', ')}
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="overflow-auto rounded border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Acción</th>
                  <th className="px-2 py-2 text-left">Código</th>
                  <th className="px-2 py-2 text-left">Nombre</th>
                  <th className="px-2 py-2 text-left">Apellido</th>
                  <th className="px-2 py-2 text-left">Departamento</th>
                  <th className="px-2 py-2 text-left">Ingreso</th>
                  <th className="px-2 py-2 text-left">Notas</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, 200).map((r) => (
                  <RowPreview key={r.rowIndex} r={r} />
                ))}
                {plan.rows.length > 200 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-center text-slate-500">
                      … y {plan.rows.length - 200} filas más (se aplicarán todas).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cerrar} disabled={aplicando}>
              Cancelar
            </Button>
            <Button onClick={aplicar} loading={aplicando} disabled={plan.resumen.total === 0}>
              Aplicar import
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, valor, color }: { label: string; valor: number; color?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${color ?? 'text-slate-800'}`}>{valor}</div>
    </div>
  );
}

const accionBadge: Record<ResolvedRow['accion'], string> = {
  crear: 'bg-emerald-100 text-emerald-700',
  actualizar: 'bg-blue-100 text-blue-700',
  omitir: 'bg-amber-100 text-amber-700',
};

function RowPreview({ r }: { r: ResolvedRow }) {
  const apellido = [r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ');
  const notas: string[] = [];
  if (r.motivo_omitir) notas.push(r.motivo_omitir);
  if (r.faltantes.length > 0) notas.push(`Se creará: ${r.faltantes.join(' · ')}`);
  if (r.niveles_intermedios.length > 0) {
    notas.push(`Áreas: ${r.niveles_intermedios.join(' › ')}`);
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${accionBadge[r.accion]}`}
        >
          {r.accion}
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-slate-700">{r.codigo}</td>
      <td className="px-2 py-1.5">{r.nombre}</td>
      <td className="px-2 py-1.5">{apellido || '—'}</td>
      <td className="px-2 py-1.5 text-slate-600">{r.departamento_raw ?? '—'}</td>
      <td className="px-2 py-1.5 text-slate-600">{r.fecha_ingreso || '—'}</td>
      <td className="px-2 py-1.5 text-amber-700">{notas.join(' · ')}</td>
    </tr>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCatalogos } from '@/hooks/useCatalogos';
import { VacacionSaldo, listSaldos } from '@/services/vacacionesService';

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function colorSaldo(saldo: number) {
  if (saldo <= 0) return 'text-red-700 bg-red-50';
  if (saldo <= 5) return 'text-yellow-700 bg-yellow-50';
  return 'text-green-700 bg-green-50';
}

export default function SaldosPanel() {
  const { sucursales } = useCatalogos();
  const [rows, setRows] = useState<VacacionSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sucursalId, setSucursalId] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRows(await listSaldos({ sucursal_id: sucursalId || undefined, q }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId, q]);

  const totales = useMemo(() => {
    const totalEmpleados = rows.length;
    const totalDisponibles = rows.reduce(
      (a, r) => a + (r.dias_ganados_total - r.dias_tomados),
      0,
    );
    const sinSaldo = rows.filter((r) => r.dias_ganados_total - r.dias_tomados <= 0).length;
    return { totalEmpleados, totalDisponibles, sinSaldo };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Empleados</div>
          <div className="mt-1 text-2xl font-semibold">{totales.totalEmpleados}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Días disponibles totales
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-brand-700">
            {totales.totalDisponibles}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Empleados sin saldo
          </div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{totales.sinSaldo}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, apellido o código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          placeholder="Todas las sucursales"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Ingreso</th>
              <th className="px-4 py-3 text-right">Antigüedad</th>
              <th className="px-4 py-3 text-right">Días ganados</th>
              <th className="px-4 py-3 text-right">Tomados</th>
              <th className="px-4 py-3 text-right">Disponibles</th>
              <th className="px-4 py-3">Próximo aniversario</th>
              <th className="px-4 py-3 text-right">Próx. periodo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Sin empleados que cumplan el filtro.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const saldo = r.dias_ganados_total - r.dias_tomados;
              const nombreCompleto = [r.nombre, r.apellido_paterno, r.apellido_materno]
                .filter(Boolean)
                .join(' ');
              return (
                <tr key={r.empleado_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{nombreCompleto}</div>
                    <div className="text-xs text-slate-500">{r.codigo ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{fmtFecha(r.fecha_ingreso)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.anios_antiguedad} {r.anios_antiguedad === 1 ? 'año' : 'años'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.dias_ganados_total}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {Number(r.dias_tomados).toFixed(0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorSaldo(
                        saldo,
                      )}`}
                    >
                      {Number(saldo).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {fmtFecha(r.fecha_proximo_aniversario)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                    +{r.dias_proximo_periodo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Cálculo basado en la <b>tabla LFT 2023</b> (Ley Federal del Trabajo).
        Los días <b>tomados</b> incluyen incidencias de tipo "vacaciones" en estatus
        <i> aprobada</i> o <i>aplicada</i>.
      </div>
    </div>
  );
}

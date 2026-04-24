import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';

type Emp = {
  id: string;
  nombre: string;
  apellido_paterno: string | null;
  codigo: string | null;
  fecha_ingreso: string;
  fecha_baja: string | null;
  sueldo: number;
  dias_trabajados: number;
};

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function diasEnAnio(ingreso: string, baja: string | null, anio: number): number {
  const inicio = new Date(Math.max(new Date(ingreso + 'T00:00:00').getTime(), new Date(`${anio}-01-01`).getTime()));
  const fin = new Date(
    Math.min(
      baja ? new Date(baja + 'T00:00:00').getTime() : new Date().getTime(),
      new Date(`${anio}-12-31`).getTime(),
    ),
  );
  if (fin < inicio) return 0;
  return Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function PtuPanel() {
  const [anio, setAnio] = useState(new Date().getFullYear() - 1);
  const [montoTotal, setMontoTotal] = useState(0);
  const [empleados, setEmpleados] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from('empleados')
        .select('id, nombre, apellido_paterno, codigo, fecha_ingreso, fecha_baja, estatus'),
      supabase.from('empleado_sueldo').select('empleado_id, sueldo_base, vigente_desde'),
    ]).then(([eRes, sRes]) => {
      const ultimoSueldo = new Map<string, number>();
      (sRes.data ?? []).forEach((s: any) => {
        const prev = ultimoSueldo.get(s.empleado_id);
        if (!prev || prev < s.sueldo_base) ultimoSueldo.set(s.empleado_id, s.sueldo_base);
      });
      const emps: Emp[] = (eRes.data ?? []).map((e: any) => ({
        id: e.id,
        nombre: e.nombre,
        apellido_paterno: e.apellido_paterno,
        codigo: e.codigo,
        fecha_ingreso: e.fecha_ingreso,
        fecha_baja: e.fecha_baja,
        sueldo: ultimoSueldo.get(e.id) ?? 0,
        dias_trabajados: diasEnAnio(e.fecha_ingreso, e.fecha_baja, anio),
      }));
      setEmpleados(emps.filter((e) => e.dias_trabajados > 0));
      setLoading(false);
    });
  }, [anio]);

  const elegibles = useMemo(() => empleados.filter((e) => e.dias_trabajados >= 60), [empleados]);
  const totalDias = elegibles.reduce((a, e) => a + e.dias_trabajados, 0);
  const totalSueldo = elegibles.reduce((a, e) => a + e.sueldo * (e.dias_trabajados / 365), 0);

  // 50% por días, 50% por salario (LFT Art. 123)
  const mitad = montoTotal / 2;

  const filas = elegibles.map((e) => {
    const porDias = totalDias > 0 ? (mitad * e.dias_trabajados) / totalDias : 0;
    const sueldoProp = e.sueldo * (e.dias_trabajados / 365);
    const porSalario = totalSueldo > 0 ? (mitad * sueldoProp) / totalSueldo : 0;
    return { ...e, porDias, porSalario, total: porDias + porSalario };
  });

  function csv() {
    const head = 'codigo,nombre,dias,sueldo_anual,por_dias,por_salario,total_ptu\n';
    const body = filas
      .map(
        (r) =>
          `${r.codigo ?? ''},${[r.nombre, r.apellido_paterno].filter(Boolean).join(' ')},${r.dias_trabajados},${(r.sueldo * (r.dias_trabajados / 365)).toFixed(2)},${r.porDias.toFixed(2)},${r.porSalario.toFixed(2)},${r.total.toFixed(2)}`,
      )
      .join('\n');
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ptu_${anio}.csv`;
    a.click();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <b>PTU</b> según LFT Art. 123: 10% de utilidades de la empresa, repartido <b>50% por días trabajados</b> y <b>50% por salarios</b>.
        Solo aplica a empleados con <b>≥ 60 días</b> trabajados en el año fiscal. Captura el monto total
        a repartir y se distribuye automáticamente.
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Input
          label="Año fiscal"
          type="number"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
        />
        <Input
          label="Monto total a repartir (MXN)"
          type="number"
          step="0.01"
          min={0}
          value={montoTotal}
          onChange={(e) => setMontoTotal(Number(e.target.value) || 0)}
        />
        <div className="flex items-end justify-end">
          <Button variant="secondary" onClick={csv} disabled={!montoTotal}>
            <Download size={16} /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Elegibles (≥60 días)" value={String(elegibles.length)} />
        <Stat label="Total días trabajados" value={String(totalDias)} />
        <Stat
          label="Total a repartir"
          value={fmt.format(montoTotal)}
          color="text-brand-700"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3 text-right">Días</th>
              <th className="px-4 py-3 text-right">Sueldo</th>
              <th className="px-4 py-3 text-right">Por días</th>
              <th className="px-4 py-3 text-right">Por salario</th>
              <th className="px-4 py-3 text-right">PTU total</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin empleados elegibles.
                </td>
              </tr>
            )}
            {filas.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">
                    {[r.nombre, r.apellido_paterno].filter(Boolean).join(' ')}
                  </div>
                  <div className="text-xs text-slate-500">{r.codigo ?? '—'}</div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.dias_trabajados}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {fmt.format(r.sueldo)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.porDias)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.porSalario)}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-brand-700">
                  {fmt.format(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color ?? ''}`}>{value}</div>
    </div>
  );
}

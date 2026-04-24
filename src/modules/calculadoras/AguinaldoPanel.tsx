import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';

type Row = {
  empleado_id: string;
  nombre: string;
  apellido_paterno: string | null;
  codigo: string | null;
  fecha_ingreso: string;
  sueldo_mensual: number;
  salario_diario: number;
  dias_trabajados_anio: number;
  aguinaldo_proporcional: number;
  aguinaldo_completo_15dias: number;
};

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export default function AguinaldoPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [diasBase, setDiasBase] = useState(15);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('aguinaldo_proyectado')
      .select('*')
      .order('apellido_paterno')
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const totalProp = rows.reduce((a, r) => a + Number(r.aguinaldo_proporcional), 0);
  const factor = diasBase / 15;

  function csv() {
    const head = 'codigo,nombre,fecha_ingreso,dias,sueldo,aguinaldo_proporcional\n';
    const body = rows
      .map(
        (r) =>
          `${r.codigo ?? ''},${[r.nombre, r.apellido_paterno].filter(Boolean).join(' ')},${r.fecha_ingreso},${r.dias_trabajados_anio},${r.sueldo_mensual},${(Number(r.aguinaldo_proporcional) * factor).toFixed(2)}`,
      )
      .join('\n');
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aguinaldo_${new Date().getFullYear()}.csv`;
    a.click();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <b>Aguinaldo</b> según LFT Art. 87: mínimo 15 días de salario por año, proporcional al
        tiempo trabajado. Si tu empresa paga más, ajusta abajo.
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Input
          label="Días de aguinaldo (mínimo 15)"
          type="number"
          min={15}
          value={diasBase}
          onChange={(e) => setDiasBase(Number(e.target.value) || 15)}
        />
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Total proyectado
          </div>
          <div className="mt-1 text-2xl font-semibold text-brand-700">
            {fmt.format(totalProp * factor)}
          </div>
        </div>
        <div className="flex items-end justify-end">
          <Button variant="secondary" onClick={csv}>
            <Download size={16} /> CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Ingreso</th>
              <th className="px-4 py-3 text-right">Días trabajados</th>
              <th className="px-4 py-3 text-right">Sueldo mensual</th>
              <th className="px-4 py-3 text-right">Salario diario</th>
              <th className="px-4 py-3 text-right">Aguinaldo proyectado</th>
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
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin empleados activos.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.empleado_id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">
                    {[r.nombre, r.apellido_paterno].filter(Boolean).join(' ')}
                  </div>
                  <div className="text-xs text-slate-500">{r.codigo ?? '—'}</div>
                </td>
                <td className="px-4 py-2 text-slate-600">{r.fecha_ingreso}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.dias_trabajados_anio}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.sueldo_mensual)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {fmt.format(r.salario_diario)}
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-brand-700">
                  {fmt.format(Number(r.aguinaldo_proporcional) * factor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

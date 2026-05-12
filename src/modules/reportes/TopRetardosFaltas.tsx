import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCatalogos } from '@/hooks/useCatalogos';
import { Empresa, listEmpresas } from '@/services/empresasService';
import { getResumenAsistencia, ResumenEmpleado } from '@/services/asistenciaService';

function hoy() {
  return new Date().toISOString().slice(0, 10);
}
function hace30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function TopRetardosFaltas() {
  const { sucursales, puestos } = useCatalogos();
  const [desde, setDesde] = useState(hace30());
  const [hasta, setHasta] = useState(hoy());
  const [sucursal, setSucursal] = useState('');
  const [puestoId, setPuestoId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [limite, setLimite] = useState('20');
  const [rows, setRows] = useState<ResumenEmpleado[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listEmpresas(true).then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  async function consultar() {
    setLoading(true);
    try {
      const data = await getResumenAsistencia(desde, hasta, {
        sucursal: sucursal || undefined,
        puestoId: puestoId || undefined,
        empresaId: empresaId || undefined,
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  const N = Math.max(1, Number(limite) || 20);

  const topRetardos = useMemo(
    () =>
      [...rows]
        .filter((r) => r.retardos > 0)
        .sort((a, b) => b.minutos_retardo_total - a.minutos_retardo_total || b.retardos - a.retardos)
        .slice(0, N),
    [rows, N],
  );

  const topFaltas = useMemo(
    () => [...rows].filter((r) => r.faltas > 0).sort((a, b) => b.faltas - a.faltas).slice(0, N),
    [rows, N],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-7">
        <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <Select
          label="Empresa"
          options={empresas.map((e) => ({ value: e.id, label: e.razon_social }))}
          placeholder="Todas"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
        />
        <Select
          label="Sucursal"
          options={sucursales.map((s) => ({ value: s.nombre, label: s.nombre }))}
          placeholder="Todas"
          value={sucursal}
          onChange={(e) => setSucursal(e.target.value)}
        />
        <Select
          label="Puesto"
          options={puestos.map((p) => ({ value: p.id, label: p.nombre }))}
          placeholder="Todos"
          value={puestoId}
          onChange={(e) => setPuestoId(e.target.value)}
        />
        <Input label="Top N" type="number" min={1} max={100} value={limite} onChange={(e) => setLimite(e.target.value)} />
        <div className="flex items-end">
          <Button onClick={consultar} loading={loading} className="w-full">
            Consultar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-800">
            <Clock size={16} /> Top {N} retardos
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 w-8">#</th>
                <th className="px-3 py-2">Empleado</th>
                <th className="px-3 py-2">Sucursal / Puesto</th>
                <th className="px-3 py-2 text-right">Retardos</th>
                <th className="px-3 py-2 text-right">Min total</th>
              </tr>
            </thead>
            <tbody>
              {topRetardos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Sin retardos en el rango.
                  </td>
                </tr>
              )}
              {topRetardos.map((r, i) => (
                <tr key={r.empleado_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.empleado}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.sucursal ?? '—'}
                    {r.puesto ? ` · ${r.puesto}` : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.retardos}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-yellow-700">
                    {r.minutos_retardo_total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
            <AlertCircle size={16} /> Top {N} faltas
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 w-8">#</th>
                <th className="px-3 py-2">Empleado</th>
                <th className="px-3 py-2">Sucursal / Puesto</th>
                <th className="px-3 py-2 text-right">Faltas</th>
                <th className="px-3 py-2 text-right">% asist.</th>
              </tr>
            </thead>
            <tbody>
              {topFaltas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Sin faltas en el rango.
                  </td>
                </tr>
              )}
              {topFaltas.map((r, i) => (
                <tr key={r.empleado_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.empleado}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.sucursal ?? '—'}
                    {r.puesto ? ` · ${r.puesto}` : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-red-700">
                    {r.faltas}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.porcentaje_asistencia}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

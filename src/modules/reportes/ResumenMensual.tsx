import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useCatalogos } from '@/hooks/useCatalogos';
import { Empresa, listEmpresas } from '@/services/empresasService';
import { getResumenAsistencia, ResumenEmpleado } from '@/services/asistenciaService';

type SortKey = keyof Pick<
  ResumenEmpleado,
  | 'empleado'
  | 'dias_trabajados'
  | 'faltas'
  | 'retardos'
  | 'minutos_retardo_total'
  | 'minutos_trabajados_total'
  | 'porcentaje_asistencia'
>;

function ultimoDiaMes(year: number, monthIdx0: number) {
  return new Date(year, monthIdx0 + 1, 0).getDate();
}

function fmtHoras(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function toCsv(rows: ResumenEmpleado[]) {
  const headers = [
    'Código',
    'Empleado',
    'Sucursal',
    'Puesto',
    'Días con turno',
    'Días trabajados',
    'Faltas',
    'Retardos',
    'Min retardo',
    'Min trabajados',
    'Pendientes',
    'Descansos',
    '% asistencia',
  ];
  const escape = (v: unknown) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.codigo,
        r.empleado,
        r.sucursal,
        r.puesto,
        r.dias_con_turno,
        r.dias_trabajados,
        r.faltas,
        r.retardos,
        r.minutos_retardo_total,
        r.minutos_trabajados_total,
        r.pendientes,
        r.descansos,
        r.porcentaje_asistencia,
      ]
        .map(escape)
        .join(','),
    ),
  ];
  return lines.join('\n');
}

function descargar(rows: ResumenEmpleado[], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResumenMensual() {
  const { sucursales, puestos } = useCatalogos();
  const now = new Date();
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [sucursal, setSucursal] = useState('');
  const [puestoId, setPuestoId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [rows, setRows] = useState<ResumenEmpleado[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('empleado');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    listEmpresas(true).then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  async function consultar() {
    setLoading(true);
    try {
      const y = Number(anio);
      const m = Number(mes);
      const desde = `${anio}-${mes}-01`;
      const hasta = `${anio}-${mes}-${String(ultimoDiaMes(y, m - 1)).padStart(2, '0')}`;
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

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return na - nb;
    });
    if (sortDir === 'desc') arr.reverse();
    return arr;
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir(k === 'empleado' ? 'asc' : 'desc');
    }
  }

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
    >
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );

  const totales = useMemo(() => {
    const t = {
      faltas: 0,
      retardos: 0,
      dias_trabajados: 0,
      minutos_retardo_total: 0,
      minutos_trabajados_total: 0,
    };
    rows.forEach((r) => {
      t.faltas += r.faltas;
      t.retardos += r.retardos;
      t.dias_trabajados += r.dias_trabajados;
      t.minutos_retardo_total += r.minutos_retardo_total;
      t.minutos_trabajados_total += r.minutos_trabajados_total;
    });
    return t;
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-7">
        <Select
          label="Año"
          options={[anio, String(now.getFullYear() - 1), String(now.getFullYear())].map((y) => ({
            value: y,
            label: y,
          }))}
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
        />
        <Select
          label="Mes"
          options={[
            ['01', 'Enero'],
            ['02', 'Febrero'],
            ['03', 'Marzo'],
            ['04', 'Abril'],
            ['05', 'Mayo'],
            ['06', 'Junio'],
            ['07', 'Julio'],
            ['08', 'Agosto'],
            ['09', 'Septiembre'],
            ['10', 'Octubre'],
            ['11', 'Noviembre'],
            ['12', 'Diciembre'],
          ].map(([v, l]) => ({ value: v, label: l }))}
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        />
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
        <div className="flex items-end">
          <Button onClick={consultar} loading={loading} className="w-full">
            Consultar
          </Button>
        </div>
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={() => descargar(sorted, `resumen_${anio}-${mes}.csv`)}
            disabled={rows.length === 0}
            className="w-full"
          >
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {rows.length} empleados
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
            días trabajados: {totales.dias_trabajados}
          </span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-700">
            retardos: {totales.retardos} ({totales.minutos_retardo_total} min)
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
            faltas: {totales.faltas}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
            horas: {fmtHoras(totales.minutos_trabajados_total)}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2"><SortHeader k="empleado" label="Empleado" /></th>
              <th className="px-3 py-2 text-slate-500">Código</th>
              <th className="px-3 py-2 text-slate-500">Sucursal</th>
              <th className="px-3 py-2 text-slate-500">Puesto</th>
              <th className="px-3 py-2 text-right"><SortHeader k="dias_trabajados" label="Trabajados" /></th>
              <th className="px-3 py-2 text-right"><SortHeader k="faltas" label="Faltas" /></th>
              <th className="px-3 py-2 text-right"><SortHeader k="retardos" label="Retardos" /></th>
              <th className="px-3 py-2 text-right"><SortHeader k="minutos_retardo_total" label="Min retardo" /></th>
              <th className="px-3 py-2 text-right"><SortHeader k="minutos_trabajados_total" label="Horas" /></th>
              <th className="px-3 py-2 text-right"><SortHeader k="porcentaje_asistencia" label="% asist." /></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Sin datos. Selecciona mes y consulta.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.empleado_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{r.empleado}</td>
                <td className="px-3 py-2 text-slate-600">{r.codigo ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.sucursal ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.puesto ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.dias_trabajados}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.faltas > 0 ? <span className="text-red-700">{r.faltas}</span> : 0}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.retardos > 0 ? <span className="text-yellow-700">{r.retardos}</span> : 0}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {r.minutos_retardo_total}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtHoras(r.minutos_trabajados_total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span
                    className={
                      r.porcentaje_asistencia >= 95
                        ? 'text-green-700'
                        : r.porcentaje_asistencia >= 85
                          ? 'text-yellow-700'
                          : 'text-red-700'
                    }
                  >
                    {r.porcentaje_asistencia}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

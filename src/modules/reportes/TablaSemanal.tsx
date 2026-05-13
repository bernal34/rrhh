import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCatalogos } from '@/hooks/useCatalogos';
import { Empresa, listEmpresas } from '@/services/empresasService';
import { supabase } from '@/lib/supabase';
import { AsistenciaRow, getAsistencia } from '@/services/asistenciaService';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lunesSemanaActual() {
  const d = new Date();
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return ymd(d);
}

function domingoSemanaActual() {
  const d = new Date(lunesSemanaActual() + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return ymd(d);
}

function fmtHoras(min: number) {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function rangoDeFechas(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  while (d <= fin) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function fmtHeaderDate(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()}`;
}

const estatusColor: Record<string, string> = {
  puntual: 'bg-green-50 text-green-800',
  retardo: 'bg-yellow-50 text-yellow-800',
  falta: 'bg-red-50 text-red-800',
  descanso: 'bg-slate-50 text-slate-400',
  pendiente: 'bg-blue-50 text-blue-700',
};

export default function TablaSemanal() {
  const { sucursales, puestos } = useCatalogos();
  const [desde, setDesde] = useState(lunesSemanaActual());
  const [hasta, setHasta] = useState(domingoSemanaActual());
  const [sucursal, setSucursal] = useState('');
  const [puestoId, setPuestoId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empMeta, setEmpMeta] = useState<
    Record<string, { empresa_id: string | null; puesto_id: string | null }>
  >({});
  const [rows, setRows] = useState<AsistenciaRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listEmpresas(true).then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  async function consultar() {
    setLoading(true);
    try {
      const [data, empMetaRes] = await Promise.all([
        getAsistencia({ desde, hasta, sucursal: sucursal || undefined }),
        supabase.from('empleados').select('id, empresa_id, puesto_id'),
      ]);
      setRows(data);
      const map: Record<string, { empresa_id: string | null; puesto_id: string | null }> = {};
      ((empMetaRes.data ?? []) as Array<{
        id: string;
        empresa_id: string | null;
        puesto_id: string | null;
      }>).forEach((e) => (map[e.id] = { empresa_id: e.empresa_id, puesto_id: e.puesto_id }));
      setEmpMeta(map);
    } finally {
      setLoading(false);
    }
  }

  const fechas = useMemo(() => rangoDeFechas(desde, hasta), [desde, hasta]);

  const grouped = useMemo(() => {
    const m = new Map<
      string,
      {
        empleado: string;
        codigo: string | null;
        sucursal: string | null;
        porFecha: Map<string, AsistenciaRow>;
        totalMin: number;
        faltas: number;
        retardos: number;
      }
    >();
    for (const r of rows) {
      const meta = empMeta[r.empleado_id];
      if (empresaId && meta?.empresa_id !== empresaId) continue;
      if (puestoId && meta?.puesto_id !== puestoId) continue;
      let cur = m.get(r.empleado_id);
      if (!cur) {
        cur = {
          empleado: r.empleado,
          codigo: r.codigo,
          sucursal: r.sucursal,
          porFecha: new Map(),
          totalMin: 0,
          faltas: 0,
          retardos: 0,
        };
        m.set(r.empleado_id, cur);
      }
      cur.porFecha.set(r.fecha, r);
      cur.totalMin += r.minutos_trabajados ?? 0;
      if (r.estatus === 'falta') cur.faltas += 1;
      if (r.estatus === 'retardo') cur.retardos += 1;
    }
    return Array.from(m.values()).sort((a, b) => a.empleado.localeCompare(b.empleado));
  }, [rows, empMeta, empresaId, puestoId]);

  const totalesPorDia = useMemo(() => {
    const t: Record<string, number> = {};
    for (const e of grouped) {
      for (const [fecha, r] of e.porFecha) {
        t[fecha] = (t[fecha] ?? 0) + (r.minutos_trabajados ?? 0);
      }
    }
    return t;
  }, [grouped]);

  const granTotal = useMemo(() => grouped.reduce((acc, e) => acc + e.totalMin, 0), [grouped]);

  function descargarCsv() {
    const headers = [
      'Código',
      'Empleado',
      'Sucursal',
      ...fechas.map((f) => `${fmtHeaderDate(f)} (h)`),
      'Total h',
      'Faltas',
      'Retardos',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.map(escape).join(','),
      ...grouped.map((e) =>
        [
          e.codigo,
          e.empleado,
          e.sucursal,
          ...fechas.map((f) => ((e.porFecha.get(f)?.minutos_trabajados ?? 0) / 60).toFixed(2)),
          (e.totalMin / 60).toFixed(2),
          e.faltas,
          e.retardos,
        ]
          .map(escape)
          .join(','),
      ),
      [
        '',
        '',
        'TOTAL',
        ...fechas.map((f) => ((totalesPorDia[f] ?? 0) / 60).toFixed(2)),
        (granTotal / 60).toFixed(2),
        '',
        '',
      ]
        .map(escape)
        .join(','),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabla_semanal_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setSemanaActual() {
    setDesde(lunesSemanaActual());
    setHasta(domingoSemanaActual());
  }

  function setSemanaPrev() {
    const d = new Date(`${desde}T12:00:00`);
    d.setDate(d.getDate() - 7);
    setDesde(ymd(d));
    d.setDate(d.getDate() + 6);
    setHasta(ymd(d));
  }

  function setSemanaSig() {
    const d = new Date(`${desde}T12:00:00`);
    d.setDate(d.getDate() + 7);
    setDesde(ymd(d));
    d.setDate(d.getDate() + 6);
    setHasta(ymd(d));
  }

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
        <div className="flex items-end">
          <Button onClick={consultar} loading={loading} className="w-full">
            Consultar
          </Button>
        </div>
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={descargarCsv}
            disabled={grouped.length === 0}
            className="w-full"
          >
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={setSemanaPrev}>
          ← Semana anterior
        </Button>
        <Button variant="secondary" size="sm" onClick={setSemanaActual}>
          <Calendar size={14} /> Esta semana
        </Button>
        <Button variant="secondary" size="sm" onClick={setSemanaSig}>
          Siguiente semana →
        </Button>
        {grouped.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">
            {grouped.length} empleados · {fechas.length} días · {fmtHoras(granTotal)} totales
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Empleado</th>
              {fechas.map((f) => (
                <th key={f} className="px-3 py-2 text-right text-xs">
                  {fmtHeaderDate(f)}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right text-xs">F</th>
              <th className="px-3 py-2 text-right text-xs">R</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={fechas.length + 4} className="px-3 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && grouped.length === 0 && (
              <tr>
                <td colSpan={fechas.length + 4} className="px-3 py-6 text-center text-slate-500">
                  Sin datos. Selecciona un rango y consulta.
                </td>
              </tr>
            )}
            {grouped.map((e) => (
              <tr key={e.empleado} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <div className="font-medium text-slate-800">{e.empleado}</div>
                  <div className="text-[10px] text-slate-500">
                    {e.codigo ?? '—'}
                    {e.sucursal ? ` · ${e.sucursal}` : ''}
                  </div>
                </td>
                {fechas.map((f) => {
                  const r = e.porFecha.get(f);
                  if (!r) {
                    return (
                      <td key={f} className="px-3 py-2 text-right text-slate-300">
                        —
                      </td>
                    );
                  }
                  const cls = estatusColor[r.estatus] ?? '';
                  let content: React.ReactNode;
                  if (r.estatus === 'descanso') content = '—';
                  else if (r.estatus === 'falta') content = 'F';
                  else if (r.estatus === 'pendiente') content = '…';
                  else content = fmtHoras(r.minutos_trabajados ?? 0);
                  return (
                    <td
                      key={f}
                      className={`px-3 py-2 text-right tabular-nums text-xs ${cls}`}
                      title={`${r.estatus}${r.minutos_retardo ? ` · ${r.minutos_retardo} min retardo` : ''}`}
                    >
                      {content}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {fmtHoras(e.totalMin)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs">
                  {e.faltas > 0 ? <span className="text-red-700">{e.faltas}</span> : 0}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs">
                  {e.retardos > 0 ? <span className="text-yellow-700">{e.retardos}</span> : 0}
                </td>
              </tr>
            ))}
            {grouped.length > 0 && (
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2">TOTAL</td>
                {fechas.map((f) => (
                  <td key={f} className="px-3 py-2 text-right tabular-nums text-xs">
                    {fmtHoras(totalesPorDia[f] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{fmtHoras(granTotal)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

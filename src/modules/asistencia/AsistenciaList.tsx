import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCatalogos } from '@/hooks/useCatalogos';
import { useAuth } from '@/lib/auth';
import { Empresa, listEmpresas } from '@/services/empresasService';
import { resolverEmpresaParaPdf, pdfFooterHTML, pdfHeaderHTML } from '@/lib/pdfHeader';
import { supabase } from '@/lib/supabase';
import {
  AsistenciaRow,
  descargarCsv,
  getAsistencia,
  recalcularAsistencia,
} from '@/services/asistenciaService';

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const estatusColor: Record<string, string> = {
  puntual: 'bg-green-100 text-green-700',
  retardo: 'bg-yellow-100 text-yellow-700',
  falta: 'bg-red-100 text-red-700',
  descanso: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-blue-100 text-blue-700',
};

export default function AsistenciaList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('asistencia');
  const { sucursales } = useCatalogos();
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [sucursal, setSucursal] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [estatus, setEstatus] = useState('');
  const [allRows, setAllRows] = useState<AsistenciaRow[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empleadoEmpresaMap, setEmpleadoEmpresaMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [recalc, setRecalc] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const [rows, empMap] = await Promise.all([
        getAsistencia({ desde, hasta, sucursal: sucursal || undefined, estatus: estatus || undefined }),
        supabase.from('empleados').select('id, empresa_id'),
      ]);
      setAllRows(rows);
      const map: Record<string, string | null> = {};
      ((empMap.data ?? []) as Array<{ id: string; empresa_id: string | null }>).forEach(
        (e) => (map[e.id] = e.empresa_id),
      );
      setEmpleadoEmpresaMap(map);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(
    () =>
      empresaId
        ? allRows.filter((r) => empleadoEmpresaMap[r.empleado_id] === empresaId)
        : allRows,
    [allRows, empresaId, empleadoEmpresaMap],
  );

  useEffect(() => {
    listEmpresas(true).then(setEmpresas).catch(() => setEmpresas([]));
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRecalcular() {
    setRecalc(true);
    try {
      await recalcularAsistencia(desde, hasta);
      await cargar();
    } finally {
      setRecalc(false);
    }
  }

  async function descargarPDF() {
    const empresa = await resolverEmpresaParaPdf(empresaId || null);
    const tbody = rows
      .map(
        (r) => `<tr>
          <td>${r.fecha}</td>
          <td>${r.empleado}</td>
          <td>${r.sucursal ?? '—'}</td>
          <td>${r.turno ?? '—'}</td>
          <td>${r.entrada_real ? new Date(r.entrada_real).toLocaleTimeString('es-MX') : '—'}</td>
          <td>${r.salida_real ? new Date(r.salida_real).toLocaleTimeString('es-MX') : '—'}</td>
          <td class="r">${r.minutos_retardo ?? 0}</td>
          <td><span class="badge ${r.estatus}">${r.estatus}</span></td>
        </tr>`,
      )
      .join('');
    const totales = rows.reduce(
      (a, r) => {
        a[r.estatus] = (a[r.estatus] ?? 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    );
    const resumen = ['puntual', 'retardo', 'falta', 'descanso', 'pendiente']
      .map((k) => `<span class="badge ${k}" style="margin-right:6px">${k}: ${totales[k] ?? 0}</span>`)
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Asistencia ${desde} a ${hasta}</title>
<style>
  @page { size: letter landscape; margin: 12mm }
  body { font-family: Inter, system-ui, sans-serif; color:#0f172a; font-size:10px; margin:0 }
  table { width:100%; border-collapse:collapse; margin-top:8px }
  th { background:#f1f5f9; text-align:left; padding:5px 7px; font-size:9px; text-transform:uppercase; color:#475569; border-bottom:1px solid #cbd5e1 }
  td { padding:4px 7px; border-bottom:1px solid #e2e8f0 }
  td.r, th.r { text-align:right; font-variant-numeric:tabular-nums }
  .badge { padding:2px 6px; border-radius:999px; font-size:9px; font-weight:500 }
  .badge.puntual { background:#dcfce7; color:#15803d }
  .badge.retardo { background:#fef9c3; color:#a16207 }
  .badge.falta { background:#fee2e2; color:#b91c1c }
  .badge.descanso { background:#f1f5f9; color:#475569 }
  .badge.pendiente { background:#dbeafe; color:#1d4ed8 }
  @media print { .no-print { display:none } }
</style></head><body>
${pdfHeaderHTML(empresa, 'Reporte de asistencia', `Del ${desde} al ${hasta} · ${rows.length} registros`)}
<div style="margin:10px 0">${resumen}</div>
<table>
  <thead><tr>
    <th>Fecha</th><th>Empleado</th><th>Sucursal</th><th>Turno</th>
    <th>Entrada</th><th>Salida</th><th class="r">Retardo (min)</th><th>Estatus</th>
  </tr></thead>
  <tbody>${tbody || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">Sin registros</td></tr>'}</tbody>
</table>
${pdfFooterHTML(empresa)}
<div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:8px 16px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">Imprimir / Guardar PDF</button></div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return alert('Permite ventanas emergentes para el PDF.');
    w.document.write(html);
    w.document.close();
  }

  const resumen = rows.reduce(
    (a, r) => {
      a[r.estatus] = (a[r.estatus] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Asistencia</h1>
        <div className="flex gap-2">
          {editar && (
            <Button variant="secondary" onClick={onRecalcular} loading={recalc}>
              <RefreshCw size={16} /> Recalcular rango
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => descargarCsv(rows, `asistencia_${desde}_${hasta}.csv`)}
            disabled={rows.length === 0}
          >
            <Download size={14} /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={descargarPDF} disabled={rows.length === 0}>
            <FileText size={14} /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-6">
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
          label="Estatus"
          options={['puntual', 'retardo', 'falta', 'descanso', 'pendiente'].map((v) => ({
            value: v,
            label: v,
          }))}
          placeholder="Todos"
          value={estatus}
          onChange={(e) => setEstatus(e.target.value)}
        />
        <div className="flex items-end">
          <Button onClick={cargar} loading={loading} className="w-full">
            Consultar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(resumen).map(([k, v]) => (
          <span
            key={k}
            className={`rounded-full px-3 py-1 text-xs font-medium ${estatusColor[k] ?? ''}`}
          >
            {k}: {v}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Turno</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Retardo</th>
              <th className="px-4 py-3">Estatus</th>
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
                  Sin datos. Recalcula el rango para procesar las checadas.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.fecha}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{r.empleado}</td>
                <td className="px-4 py-2">{r.sucursal ?? '—'}</td>
                <td className="px-4 py-2">{r.turno ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums">
                  {r.entrada_real ? new Date(r.entrada_real).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {r.salida_real ? new Date(r.salida_real).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {r.minutos_retardo ? `${r.minutos_retardo} min` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      estatusColor[r.estatus] ?? ''
                    }`}
                  >
                    {r.estatus}
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

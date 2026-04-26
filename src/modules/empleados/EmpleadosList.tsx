import { useState } from 'react';
import { Plus, Search, Download, FileText, FileSignature, List, LayoutGrid, FileDown } from 'lucide-react';
import { abrirConstanciaLaboral } from '@/lib/constancia';
import { abrirContrato } from '@/lib/contrato';
import { getEmpresaPrincipal, pdfFooterHTML, pdfHeaderHTML } from '@/lib/pdfHeader';
import { useEmpleados } from '@/hooks/useEmpleados';
import { useCatalogos } from '@/hooks/useCatalogos';
import { useAuth } from '@/lib/auth';
import { Empleado, importarDesdeHik } from '@/services/empleadosService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Avatar } from '@/components/ui/Avatar';
import EmpleadoForm from './EmpleadoForm';

const estatusBadge: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  baja: 'bg-slate-200 text-slate-600',
  permiso: 'bg-yellow-100 text-yellow-700',
  vacaciones: 'bg-blue-100 text-blue-700',
};

type Vista = 'lista' | 'grid';

export default function EmpleadosList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('empleados');
  const [q, setQ] = useState('');
  const [vista, setVista] = useState<Vista>(
    () => (localStorage.getItem('empleados.vista') as Vista) || 'lista',
  );

  function cambiarVista(v: Vista) {
    setVista(v);
    localStorage.setItem('empleados.vista', v);
  }
  const [sucursalId, setSucursalId] = useState('');
  const [estatus, setEstatus] = useState('');
  const [editing, setEditing] = useState<Empleado | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [importing, setImporting] = useState(false);
  const { data, loading, error, refresh, baja } = useEmpleados({
    sucursal_id: sucursalId || undefined,
    estatus: estatus || undefined,
    q,
  });
  const { sucursales, puestos } = useCatalogos();

  async function onImportar() {
    if (!confirm('¿Importar empleados desde HikCentral Connect? Se traerán también sus fotos faciales.')) return;
    setImporting(true);
    try {
      const res = await importarDesdeHik(undefined, true);
      alert(`Importados ${res.created} nuevos · actualizados ${res.updated} · fotos en cola ${res.fotos_enqueued}`);
      await refresh();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setImporting(false);
    }
  }

  const puestoById = Object.fromEntries(puestos.map((p) => [p.id, p.nombre]));
  const sucursalById = Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]));

  function onNuevo() {
    setEditing(null);
    setFormOpen(true);
  }
  function onEditar(emp: Empleado) {
    setEditing(emp);
    setFormOpen(true);
  }
  async function onBaja(emp: Empleado) {
    const motivo = window.prompt(`Motivo de baja de ${emp.nombre}:`);
    if (!motivo) return;
    await baja(emp.id, motivo);
  }

  function descargarCSV() {
    const head = 'codigo,nombre,rfc,curp,nss,puesto,sucursal,fecha_ingreso,estatus\n';
    const body = data
      .map((e) =>
        [
          e.codigo ?? '',
          [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
          e.rfc ?? '',
          e.curp ?? '',
          e.nss ?? '',
          e.puesto_id ? puestoById[e.puesto_id] ?? '' : '',
          e.sucursal_id ? sucursalById[e.sucursal_id] ?? '' : '',
          e.fecha_ingreso,
          e.estatus,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empleados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function descargarPDF() {
    const empresa = await getEmpresaPrincipal();
    const filas = data
      .map((e) => {
        const nombre = [e.nombre, e.apellido_paterno, e.apellido_materno]
          .filter(Boolean)
          .join(' ');
        const puesto = e.puesto_id ? puestoById[e.puesto_id] ?? '—' : '—';
        const sucursal = e.sucursal_id ? sucursalById[e.sucursal_id] ?? '—' : '—';
        return `<tr>
          <td>${e.codigo ?? '—'}</td>
          <td>${nombre}</td>
          <td>${e.rfc ?? '—'}</td>
          <td>${puesto}</td>
          <td>${sucursal}</td>
          <td>${e.fecha_ingreso}</td>
          <td><span class="badge ${e.estatus}">${e.estatus}</span></td>
        </tr>`;
      })
      .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Listado de empleados</title>
<style>
  @page { size: letter landscape; margin: 12mm; }
  body { font-family: Inter, system-ui, sans-serif; color: #0f172a; font-size: 11px; margin: 0 }
  table { width: 100%; border-collapse: collapse }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1 }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0 }
  .badge { padding: 2px 6px; border-radius: 999px; font-size: 10px; font-weight: 500 }
  .badge.activo { background: #dcfce7; color: #15803d }
  .badge.baja { background: #e2e8f0; color: #475569 }
  .badge.permiso { background: #fef9c3; color: #a16207 }
  .badge.vacaciones { background: #dbeafe; color: #1d4ed8 }
  @media print { .no-print { display: none } }
</style></head><body>
${pdfHeaderHTML(empresa, 'Listado de empleados', `${data.length} registros`)}
<table>
  <thead><tr>
    <th>Código</th><th>Nombre</th><th>RFC</th><th>Puesto</th><th>Sucursal</th><th>Ingreso</th><th>Estatus</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">Sin registros</td></tr>'}</tbody>
</table>
${pdfFooterHTML(empresa)}
<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:8px 16px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">Imprimir / Guardar PDF</button>
</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      alert('Permite ventanas emergentes para descargar el PDF.');
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data.length} registros</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
            <button
              onClick={() => cambiarVista('lista')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                vista === 'lista' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              title="Vista lista"
            >
              <List size={14} /> Lista
            </button>
            <button
              onClick={() => cambiarVista('grid')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                vista === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              title="Vista cuadrícula"
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={descargarCSV} disabled={data.length === 0}>
            <FileDown size={14} /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={descargarPDF} disabled={data.length === 0}>
            <FileText size={14} /> PDF
          </Button>
          {editar && (
            <>
              <Button variant="secondary" onClick={onImportar} loading={importing}>
                <Download size={16} /> Importar desde HCC
              </Button>
              <Button onClick={onNuevo}>
                <Plus size={16} /> Nuevo empleado
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, RFC, CURP o código…"
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
        <Select
          options={[
            { value: 'activo', label: 'Activo' },
            { value: 'permiso', label: 'Permiso' },
            { value: 'vacaciones', label: 'Vacaciones' },
            { value: 'baja', label: 'Baja' },
          ]}
          placeholder="Todos los estatus"
          value={estatus}
          onChange={(e) => setEstatus(e.target.value)}
        />
      </div>

      {vista === 'grid' ? (
        <>
          {loading && <div className="text-center text-slate-500 py-8">Cargando…</div>}
          {error && <div className="text-center text-red-600 py-8">{error}</div>}
          {!loading && !error && data.length === 0 && (
            <div className="text-center text-slate-500 py-12 rounded-lg border border-dashed border-slate-300 bg-white">
              Sin resultados.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((emp) => {
              const nombreCompleto = [emp.nombre, emp.apellido_paterno, emp.apellido_materno]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  key={emp.id}
                  className={`group rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition-all hover:shadow-card ${
                    editar ? 'cursor-pointer hover:-translate-y-0.5' : ''
                  }`}
                  onClick={() => editar && onEditar(emp)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={emp.foto_url ?? undefined} name={emp.nombre} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-800">{nombreCompleto}</div>
                      <div className="truncate text-xs text-slate-500">
                        {emp.codigo ?? '—'} · {emp.rfc ?? 'sin RFC'}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        estatusBadge[emp.estatus] ?? 'bg-slate-100'
                      }`}
                    >
                      {emp.estatus}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Puesto</dt>
                      <dd className="text-slate-700 font-medium truncate ml-2">
                        {emp.puesto_id ? puestoById[emp.puesto_id] ?? '—' : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Sucursal</dt>
                      <dd className="text-slate-700 font-medium truncate ml-2">
                        {emp.sucursal_id ? sucursalById[emp.sucursal_id] ?? '—' : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Ingreso</dt>
                      <dd className="text-slate-700 font-medium">{emp.fecha_ingreso}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => abrirConstanciaLaboral(emp.id)} title="Constancia">
                      <FileText size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => abrirContrato(emp.id)} title="Contrato">
                      <FileSignature size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Puesto</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Ingreso</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3 text-right">Acciones</th>
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
            {error && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Sin resultados.
                </td>
              </tr>
            )}
            {data.map((emp) => (
              <tr
                key={emp.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  editar ? 'cursor-pointer' : ''
                }`}
                onClick={() => editar && onEditar(emp)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={emp.foto_url ?? undefined} name={emp.nombre} />
                    <div>
                      <div className="font-medium text-slate-800">
                        {[emp.nombre, emp.apellido_paterno, emp.apellido_materno]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {emp.codigo ?? '—'} · {emp.rfc ?? 'sin RFC'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {emp.puesto_id ? puestoById[emp.puesto_id] ?? '—' : '—'}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {emp.sucursal_id ? sucursalById[emp.sucursal_id] ?? '—' : '—'}
                </td>
                <td className="px-4 py-3 text-slate-700">{emp.fecha_ingreso}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      estatusBadge[emp.estatus] ?? 'bg-slate-100'
                    }`}
                  >
                    {emp.estatus}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => abrirConstanciaLaboral(emp.id)}
                    title="Generar constancia laboral"
                  >
                    <FileText size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => abrirContrato(emp.id)}
                    title="Generar contrato individual de trabajo"
                  >
                    <FileSignature size={14} />
                  </Button>
                  {editar && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => onEditar(emp)}>
                        Editar
                      </Button>
                      {emp.estatus !== 'baja' && (
                        <Button variant="ghost" size="sm" onClick={() => onBaja(emp)}>
                          Dar de baja
                        </Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <EmpleadoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        empleado={editing}
        onSaved={refresh}
      />
    </div>
  );
}

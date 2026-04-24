import { useState } from 'react';
import { Plus, Search, Download } from 'lucide-react';
import { useEmpleados } from '@/hooks/useEmpleados';
import { useCatalogos } from '@/hooks/useCatalogos';
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

export default function EmpleadosList() {
  const [q, setQ] = useState('');
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empleados</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onImportar} loading={importing}>
            <Download size={16} /> Importar desde HCC
          </Button>
          <Button onClick={onNuevo}>
            <Plus size={16} /> Nuevo empleado
          </Button>
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
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => onEditar(emp)}
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
                  <Button variant="ghost" size="sm" onClick={() => onEditar(emp)}>
                    Editar
                  </Button>
                  {emp.estatus !== 'baja' && (
                    <Button variant="ghost" size="sm" onClick={() => onBaja(emp)}>
                      Dar de baja
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EmpleadoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        empleado={editing}
        onSaved={refresh}
      />
    </div>
  );
}

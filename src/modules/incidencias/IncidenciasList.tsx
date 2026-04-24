import { FormEvent, useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import {
  Incidencia,
  TipoIncidencia,
  aprobarIncidencia,
  listIncidencias,
  rechazarIncidencia,
  tipoIncidenciaLabel,
  upsertIncidencia,
} from '@/services/incidenciasService';
import { Empleado, listEmpleados } from '@/services/empleadosService';

const estatusColor: Record<string, string> = {
  registrada: 'bg-slate-100 text-slate-700',
  aprobada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  aplicada: 'bg-blue-100 text-blue-700',
};

export default function IncidenciasList() {
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [estatusF, setEstatusF] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRows(
        await listIncidencias({
          estatus: (estatusF || undefined) as Incidencia['estatus'] | undefined,
        }),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estatusF]);

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Incidencias</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Registrar incidencia
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <Select
          className="max-w-xs"
          placeholder="Todos los estatus"
          options={['registrada', 'aprobada', 'rechazada', 'aplicada'].map((v) => ({
            value: v,
            label: v,
          }))}
          value={estatusF}
          onChange={(e) => setEstatusF(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Rango</th>
              <th className="px-4 py-3">Días</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Sin incidencias.
                </td>
              </tr>
            )}
            {rows.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">
                  {i.empleado
                    ? `${i.empleado.nombre} ${i.empleado.apellido_paterno ?? ''}`.trim()
                    : '—'}
                </td>
                <td className="px-4 py-2">{tipoIncidenciaLabel[i.tipo]}</td>
                <td className="px-4 py-2">
                  {i.fecha_inicio} → {i.fecha_fin}
                </td>
                <td className="px-4 py-2 tabular-nums">{i.dias ?? '—'}</td>
                <td className="px-4 py-2 max-w-xs truncate">{i.descripcion ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      estatusColor[i.estatus] ?? ''
                    }`}
                  >
                    {i.estatus}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {i.estatus === 'registrada' && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => accion(() => aprobarIncidencia(i.id))}
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const m = prompt('Motivo de rechazo:');
                          if (m) accion(() => rechazarIncidencia(i.id, m));
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IncidenciaForm
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function IncidenciaForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [form, setForm] = useState<Partial<Incidencia>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        tipo: 'permiso_con_goce',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: new Date().toISOString().slice(0, 10),
        afecta_sueldo: true,
        afecta_asistencia: true,
      });
      listEmpleados({ estatus: 'activo' }).then(setEmpleados);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertIncidencia(form);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva incidencia" size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Empleado *"
          required
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`,
          }))}
          value={form.empleado_id ?? ''}
          onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
        />
        <Select
          label="Tipo *"
          options={(Object.keys(tipoIncidenciaLabel) as TipoIncidencia[]).map((t) => ({
            value: t,
            label: tipoIncidenciaLabel[t],
          }))}
          value={form.tipo ?? 'permiso_con_goce'}
          onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoIncidencia })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Desde *"
            type="date"
            required
            value={form.fecha_inicio ?? ''}
            onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
          />
          <Input
            label="Hasta *"
            type="date"
            required
            value={form.fecha_fin ?? ''}
            onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
          />
        </div>
        <Input
          label="Folio IMSS (incapacidades)"
          value={form.folio_imss ?? ''}
          onChange={(e) => setForm({ ...form, folio_imss: e.target.value })}
        />
        <div>
          <label className="text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            rows={3}
            value={form.descripcion ?? ''}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.afecta_sueldo}
              onChange={(e) => setForm({ ...form, afecta_sueldo: e.target.checked })}
            />
            Afecta sueldo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.afecta_asistencia}
              onChange={(e) => setForm({ ...form, afecta_asistencia: e.target.checked })}
            />
            Afecta asistencia
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

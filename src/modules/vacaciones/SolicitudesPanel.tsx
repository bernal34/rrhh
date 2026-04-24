import { FormEvent, useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import {
  VacacionSolicitud,
  aprobarSolicitud,
  listSolicitudes,
  rechazarSolicitud,
  solicitarVacaciones,
} from '@/services/vacacionesService';
import { Empleado, listEmpleados } from '@/services/empleadosService';

const estatusColor: Record<string, string> = {
  registrada: 'bg-slate-100 text-slate-700',
  aprobada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  aplicada: 'bg-blue-100 text-blue-700',
};

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SolicitudesPanel() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('vacaciones') || puedeEditar('incidencias');
  const [rows, setRows] = useState<VacacionSolicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [estatus, setEstatus] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await listSolicitudes({ estatus: estatus || undefined }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estatus]);

  async function ejecutar(fn: () => Promise<void>) {
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
        <Select
          className="max-w-xs"
          placeholder="Todos los estatus"
          options={['registrada', 'aprobada', 'rechazada', 'aplicada'].map((v) => ({
            value: v,
            label: v,
          }))}
          value={estatus}
          onChange={(e) => setEstatus(e.target.value)}
        />
        {editar && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Solicitar vacaciones
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3">Hasta</th>
              <th className="px-4 py-3 text-right">Días</th>
              <th className="px-4 py-3">Motivo</th>
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
                  Sin solicitudes.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{s.empleado_nombre}</div>
                  <div className="text-xs text-slate-500">{s.empleado_codigo ?? '—'}</div>
                </td>
                <td className="px-4 py-2 text-slate-700">{fmtFecha(s.fecha_inicio)}</td>
                <td className="px-4 py-2 text-slate-700">{fmtFecha(s.fecha_fin)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(s.dias).toFixed(0)}</td>
                <td className="px-4 py-2 max-w-xs truncate text-slate-600">
                  {s.descripcion ?? '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      estatusColor[s.estatus]
                    }`}
                  >
                    {s.estatus}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {editar && s.estatus === 'registrada' && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ejecutar(() => aprobarSolicitud(s.id))}
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const m = prompt('Motivo de rechazo:');
                          if (m) ejecutar(() => rechazarSolicitud(s.id, m));
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

      <SolicitudForm
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

function SolicitudForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleado_id, setEmpleadoId] = useState('');
  const [fecha_inicio, setIni] = useState(new Date().toISOString().slice(0, 10));
  const [fecha_fin, setFin] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmpleadoId('');
      setIni(new Date().toISOString().slice(0, 10));
      setFin(new Date().toISOString().slice(0, 10));
      setDesc('');
      setErr(null);
      listEmpleados({ estatus: 'activo' }).then(setEmpleados);
    }
  }, [open]);

  const dias = Math.floor(
    (new Date(fecha_fin).getTime() - new Date(fecha_inicio).getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await solicitarVacaciones({ empleado_id, fecha_inicio, fecha_fin, descripcion });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Solicitar vacaciones">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Empleado *"
          required
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
          }))}
          value={empleado_id}
          onChange={(e) => setEmpleadoId(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Desde *"
            type="date"
            required
            value={fecha_inicio}
            onChange={(e) => setIni(e.target.value)}
          />
          <Input
            label="Hasta *"
            type="date"
            required
            value={fecha_fin}
            min={fecha_inicio}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-600">
          Días solicitados: <b className="text-slate-800">{dias > 0 ? dias : 0}</b>
        </div>
        <Input
          label="Motivo / observaciones"
          value={descripcion}
          onChange={(e) => setDesc(e.target.value)}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!empleado_id || dias <= 0}>
            Registrar solicitud
          </Button>
        </div>
      </form>
    </Modal>
  );
}

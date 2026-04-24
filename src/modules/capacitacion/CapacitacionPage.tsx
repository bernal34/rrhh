import { FormEvent, useEffect, useState } from 'react';
import { Plus, Users, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth';
import {
  Capacitacion,
  listAsistentes,
  listCapacitaciones,
  quitarAsistente,
  setAsistente,
  upsertCapacitacion,
} from '@/services/capacitacionService';
import { Empleado, listEmpleados } from '@/services/empleadosService';
import { abrirDC3 } from '@/lib/dc3';

const TIPOS = ['Inducción', 'Seguridad', 'Técnica', 'NOM-035', 'NOM-030', 'Calidad', 'Otro'];

export default function CapacitacionPage() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('capacitacion');
  const [rows, setRows] = useState<Capacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Capacitacion | null>(null);
  const [capAsist, setCapAsist] = useState<Capacitacion | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await listCapacitaciones());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Capacitación</h1>
        {editar && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            <Plus size={16} /> Nueva capacitación
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Horas</th>
              <th className="px-4 py-3">Instructor</th>
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
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin capacitaciones registradas.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{c.nombre}</td>
                <td className="px-4 py-2">{c.tipo ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">{c.fecha}</td>
                <td className="px-4 py-2 text-right tabular-nums">{c.duracion_horas}</td>
                <td className="px-4 py-2 text-slate-600">{c.instructor ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setCapAsist(c)}>
                    <Users size={14} /> Asistentes
                  </Button>
                  {editar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(c);
                        setOpenForm(true);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CapacitacionForm
        open={openForm}
        onClose={() => setOpenForm(false)}
        capacitacion={editing}
        onSaved={() => {
          setOpenForm(false);
          void load();
        }}
      />
      <AsistentesModal capacitacion={capAsist} onClose={() => setCapAsist(null)} editar={editar} />
    </div>
  );
}

function CapacitacionForm({
  open,
  onClose,
  capacitacion,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  capacitacion: Capacitacion | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Capacitacion>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        capacitacion ?? {
          nombre: '',
          fecha: new Date().toISOString().slice(0, 10),
          duracion_horas: 1,
          tipo: 'Inducción',
        },
      );
    }
  }, [open, capacitacion]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertCapacitacion(form);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={capacitacion ? 'Editar capacitación' : 'Nueva capacitación'}
      size="lg"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            options={TIPOS.map((t) => ({ value: t, label: t }))}
            value={form.tipo ?? 'Inducción'}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          />
          <Input
            label="Tema / área"
            value={form.tema ?? ''}
            onChange={(e) => setForm({ ...form, tema: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Fecha *"
            type="date"
            required
            value={form.fecha ?? ''}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          />
          <Input
            label="Duración (horas) *"
            type="number"
            step="0.5"
            min={0}
            required
            value={form.duracion_horas ?? 1}
            onChange={(e) => setForm({ ...form, duracion_horas: Number(e.target.value) })}
          />
          <Input
            label="Lugar"
            value={form.lugar ?? ''}
            onChange={(e) => setForm({ ...form, lugar: e.target.value })}
          />
        </div>
        <Input
          label="Instructor"
          value={form.instructor ?? ''}
          onChange={(e) => setForm({ ...form, instructor: e.target.value })}
        />
        <Input
          label="Notas"
          value={form.notas ?? ''}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
        />
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AsistentesModal({
  capacitacion,
  onClose,
  editar,
}: {
  capacitacion: Capacitacion | null;
  onClose: () => void;
  editar: boolean;
}) {
  const [asistentes, setAsistentes] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [agregarId, setAgregarId] = useState('');

  async function load() {
    if (!capacitacion) return;
    setAsistentes(await listAsistentes(capacitacion.id));
  }

  useEffect(() => {
    if (capacitacion) {
      void load();
      listEmpleados({ estatus: 'activo' }).then(setEmpleados);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacitacion?.id]);

  async function agregar() {
    if (!agregarId || !capacitacion) return;
    await setAsistente(capacitacion.id, agregarId, true);
    setAgregarId('');
    await load();
  }

  async function quitar(empId: string) {
    if (!capacitacion) return;
    await quitarAsistente(capacitacion.id, empId);
    await load();
  }

  if (!capacitacion) return null;
  const idsAsignados = new Set(asistentes.map((a) => a.empleado_id));
  const disponibles = empleados.filter((e) => !idsAsignados.has(e.id));

  return (
    <Modal open onClose={onClose} title={`Asistentes · ${capacitacion.nombre}`} size="lg">
      <div className="flex flex-col gap-3">
        {editar && (
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                placeholder="Agregar empleado…"
                options={disponibles.map((e) => ({
                  value: e.id,
                  label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
                }))}
                value={agregarId}
                onChange={(e) => setAgregarId(e.target.value)}
              />
            </div>
            <Button onClick={agregar} disabled={!agregarId}>
              <Plus size={14} /> Agregar
            </Button>
          </div>
        )}
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Empleado</th>
                <th className="px-3 py-2">CURP</th>
                <th className="px-3 py-2">Acreditado</th>
                <th className="px-3 py-2 text-right">DC-3</th>
              </tr>
            </thead>
            <tbody>
              {asistentes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Sin asistentes aún.
                  </td>
                </tr>
              )}
              {asistentes.map((a) => (
                <tr key={a.empleado_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {a.empleado
                      ? `${a.empleado.nombre} ${a.empleado.apellido_paterno ?? ''}`.trim()
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {a.empleado?.curp ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    {a.acreditado ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Sí
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirDC3(capacitacion.id, a.empleado_id)}
                    >
                      <FileText size={14} /> DC-3
                    </Button>
                    {editar && (
                      <Button variant="ghost" size="sm" onClick={() => quitar(a.empleado_id)}>
                        <X size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

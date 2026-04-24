import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import {
  Turno,
  deleteTurno,
  listTurnos,
  upsertTurno,
} from '@/services/horariosService';

export default function TurnosPanel() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('horarios');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Turno | null>(null);

  async function load() {
    setLoading(true);
    try {
      setTurnos(await listTurnos(true));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onBorrar(t: Turno) {
    if (!confirm(`¿Desactivar turno "${t.nombre}"?`)) return;
    await deleteTurno(t.id);
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      {editar && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} /> Nuevo turno
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Turno</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Tol. retardo</th>
              <th className="px-4 py-3">Tol. falta</th>
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
            {!loading && turnos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin turnos.
                </td>
              </tr>
            )}
            {turnos.map((t) => (
              <tr
                key={t.id}
                className={`border-t border-slate-100 ${
                  editar ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
                onClick={() => {
                  if (!editar) return;
                  setEditing(t);
                  setOpen(true);
                }}
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                    style={{ background: t.color ?? '#6366f1' }}
                  />
                  {t.nombre}
                </td>
                <td className="px-4 py-3">{t.hora_entrada}</td>
                <td className="px-4 py-3">{t.hora_salida}</td>
                <td className="px-4 py-3">{t.tolerancia_retardo_min} min</td>
                <td className="px-4 py-3">{t.tolerancia_falta_min} min</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {editar && (
                    <Button variant="ghost" size="sm" onClick={() => onBorrar(t)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TurnoForm
        open={open}
        onClose={() => setOpen(false)}
        turno={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function TurnoForm({
  open,
  onClose,
  turno,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  turno: Turno | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Turno>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        turno ?? {
          nombre: '',
          hora_entrada: '08:00',
          hora_salida: '16:00',
          tolerancia_retardo_min: 10,
          tolerancia_falta_min: 60,
          color: '#6366f1',
        },
      );
      setErr(null);
    }
  }, [open, turno]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertTurno(form);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={turno ? 'Editar turno' : 'Nuevo turno'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Entrada *"
            type="time"
            required
            value={form.hora_entrada ?? ''}
            onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
          />
          <Input
            label="Salida *"
            type="time"
            required
            value={form.hora_salida ?? ''}
            onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tolerancia retardo (min)"
            type="number"
            min={0}
            value={form.tolerancia_retardo_min ?? 10}
            onChange={(e) =>
              setForm({ ...form, tolerancia_retardo_min: Number(e.target.value) })
            }
          />
          <Input
            label="Tolerancia falta (min)"
            type="number"
            min={0}
            value={form.tolerancia_falta_min ?? 60}
            onChange={(e) => setForm({ ...form, tolerancia_falta_min: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Color"
          type="color"
          value={form.color ?? '#6366f1'}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
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

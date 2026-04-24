import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Puesto,
  deletePuesto,
  listPuestos,
  reactivarPuesto,
  upsertPuesto,
} from '@/services/catalogosService';

const fmtMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

export default function PuestosList() {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [verInactivos, setVerInactivos] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Puesto | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPuestos(await listPuestos(!verInactivos));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [verInactivos]);

  async function onBorrar(p: Puesto) {
    if (!confirm(`¿Desactivar puesto "${p.nombre}"?`)) return;
    await deletePuesto(p.id);
    await load();
  }

  async function onReactivar(p: Puesto) {
    await reactivarPuesto(p.id);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Puestos</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
            Mostrar inactivos
          </label>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} /> Nuevo puesto
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3 text-right">Sueldo base sugerido</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && puestos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Sin puestos registrados.
                </td>
              </tr>
            )}
            {puestos.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => {
                  setEditing(p);
                  setOpen(true);
                }}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{p.descripcion ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {p.sueldo_base_sugerido != null ? fmtMXN.format(p.sueldo_base_sugerido) : '—'}
                </td>
                <td className="px-4 py-3">
                  {p.activo ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {p.activo ? (
                    <Button variant="ghost" size="sm" onClick={() => onBorrar(p)}>
                      <Trash2 size={14} />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => onReactivar(p)}>
                      <RotateCcw size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PuestoForm
        open={open}
        onClose={() => setOpen(false)}
        puesto={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function PuestoForm({
  open,
  onClose,
  puesto,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  puesto: Puesto | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Puesto>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        puesto ?? {
          nombre: '',
          descripcion: '',
          sueldo_base_sugerido: null,
          activo: true,
        },
      );
      setErr(null);
    }
  }, [open, puesto]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await upsertPuesto(form);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={puesto ? 'Editar puesto' : 'Nuevo puesto'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Cajero, Mesero, Gerente, Albañil…"
        />
        <Input
          label="Descripción"
          value={form.descripcion ?? ''}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Funciones principales del puesto"
        />
        <Input
          label="Sueldo base sugerido (MXN)"
          type="number"
          min={0}
          step="0.01"
          value={form.sueldo_base_sugerido ?? ''}
          onChange={(e) =>
            setForm({
              ...form,
              sueldo_base_sugerido: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
        {puesto && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.activo ?? true}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            Activo
          </label>
        )}
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

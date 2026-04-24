import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import {
  Sucursal,
  deleteSucursal,
  listSucursales,
  reactivarSucursal,
  upsertSucursal,
} from '@/services/catalogosService';

export default function SucursalesList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('sucursales');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [verInactivas, setVerInactivas] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sucursal | null>(null);

  async function load() {
    setLoading(true);
    try {
      setSucursales(await listSucursales(!verInactivas));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [verInactivas]);

  async function onBorrar(s: Sucursal) {
    if (!confirm(`¿Desactivar sucursal "${s.nombre}"?`)) return;
    await deleteSucursal(s.id);
    await load();
  }

  async function onReactivar(s: Sucursal) {
    await reactivarSucursal(s.id);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sucursales / Obras</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={verInactivas}
              onChange={(e) => setVerInactivas(e.target.checked)}
            />
            Mostrar inactivas
          </label>
          {editar && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={16} /> Nueva sucursal
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Dirección</th>
              <th className="px-4 py-3">Teléfono</th>
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
            {!loading && sucursales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Sin sucursales registradas.
                </td>
              </tr>
            )}
            {sucursales.map((s) => (
              <tr
                key={s.id}
                className={`border-t border-slate-100 ${
                  editar ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
                onClick={() => {
                  if (!editar) return;
                  setEditing(s);
                  setOpen(true);
                }}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{s.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{s.direccion ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.telefono ?? '—'}</td>
                <td className="px-4 py-3">
                  {s.activo ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Activa
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Inactiva
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {editar &&
                    (s.activo ? (
                      <Button variant="ghost" size="sm" onClick={() => onBorrar(s)}>
                        <Trash2 size={14} />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onReactivar(s)}>
                        <RotateCcw size={14} />
                      </Button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SucursalForm
        open={open}
        onClose={() => setOpen(false)}
        sucursal={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function SucursalForm({
  open,
  onClose,
  sucursal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sucursal: Sucursal | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Sucursal>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        sucursal ?? {
          nombre: '',
          direccion: '',
          telefono: '',
          activo: true,
        },
      );
      setErr(null);
    }
  }, [open, sucursal]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await upsertSucursal(form);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sucursal ? 'Editar sucursal' : 'Nueva sucursal'}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Matriz, Obra Polanco, Sucursal Centro…"
        />
        <Input
          label="Dirección"
          value={form.direccion ?? ''}
          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
        />
        <Input
          label="Teléfono"
          value={form.telefono ?? ''}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
        {sucursal && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.activo ?? true}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            Activa
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

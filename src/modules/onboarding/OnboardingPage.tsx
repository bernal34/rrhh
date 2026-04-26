import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Circle, UserCheck, UserMinus, Settings, Plus, Trash2, ClipboardCheck } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/auth';
import {
  ChecklistItem,
  EstadoItem,
  eliminarItem,
  listEstados,
  listItems,
  setEstado,
  upsertItem,
} from '@/services/checklistService';
import { Empleado, listEmpleados } from '@/services/empleadosService';

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Onboarding / Offboarding</h1>
      <Tabs
        tabs={[
          {
            key: 'on',
            label: 'Onboarding',
            content: <ChecklistPanel flujo="onboarding" icono={<UserCheck />} />,
          },
          {
            key: 'off',
            label: 'Offboarding',
            content: <ChecklistPanel flujo="offboarding" icono={<UserMinus />} />,
          },
        ]}
      />
    </div>
  );
}

function ChecklistPanel({
  flujo,
  icono,
}: {
  flujo: 'onboarding' | 'offboarding';
  icono: React.ReactNode;
}) {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('onboarding');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [estados, setEstados] = useState<EstadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  async function reloadItems() {
    setItems(await listItems(flujo));
  }

  useEffect(() => {
    void reloadItems();
    listEmpleados({
      estatus: flujo === 'offboarding' ? 'baja' : 'activo',
    }).then(setEmpleados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flujo]);

  useEffect(() => {
    if (!empleadoId) {
      setEstados([]);
      return;
    }
    setLoading(true);
    listEstados(empleadoId)
      .then(setEstados)
      .finally(() => setLoading(false));
  }, [empleadoId]);

  async function toggle(itemId: string, cumplido: boolean) {
    await setEstado(empleadoId, itemId, cumplido);
    setEstados(await listEstados(empleadoId));
  }

  const completados = estados.filter((e) => e.cumplido).length;
  const total = items.length;
  const pct = total ? Math.round((completados / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select
              label="Empleado"
              placeholder="Selecciona empleado"
              options={empleados.map((e) => ({
                value: e.id,
                label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
              }))}
              value={empleadoId}
              onChange={(e) => setEmpleadoId(e.target.value)}
            />
          </div>
          {editar && (
            <Button variant="secondary" onClick={() => setEditorOpen(true)}>
              <Settings size={14} /> Editar items
            </Button>
          )}
        </div>
      </div>

      {empleadoId && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                {icono} Progreso
              </span>
              <span className="tabular-nums text-slate-600">
                {completados}/{total} ({pct}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cumplido</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                )}
                {items.map((it) => {
                  const e = estados.find((x) => x.item_id === it.id);
                  const cumplido = e?.cumplido ?? false;
                  return (
                    <tr key={it.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <button
                          disabled={!editar}
                          onClick={() => editar && toggle(it.id, !cumplido)}
                          className={`text-${cumplido ? 'green' : 'slate'}-${cumplido ? '600' : '400'} disabled:cursor-not-allowed`}
                          title={cumplido ? 'Desmarcar' : 'Marcar como cumplido'}
                        >
                          {cumplido ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className={`font-medium ${cumplido ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {it.titulo}
                        </div>
                        {it.descripcion && (
                          <div className="text-xs text-slate-500">{it.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {it.obligatorio ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Obligatorio
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            Opcional
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {e?.cumplido_at
                          ? new Date(e.cumplido_at).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!empleadoId && (
        <EmptyState
          icon={ClipboardCheck}
          title="Selecciona un empleado"
          description={`Elige un empleado del menú para ver y marcar su checklist de ${flujo === 'onboarding' ? 'incorporación' : 'salida'}.`}
        />
      )}

      <ItemsEditor
        open={editorOpen}
        flujo={flujo}
        items={items}
        onClose={() => setEditorOpen(false)}
        onChanged={reloadItems}
      />
    </div>
  );
}

function ItemsEditor({
  open,
  flujo,
  items,
  onClose,
  onChanged,
}: {
  open: boolean;
  flujo: 'onboarding' | 'offboarding';
  items: ChecklistItem[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<Partial<ChecklistItem> | null>(null);

  async function onBorrar(it: ChecklistItem) {
    if (!confirm(`¿Desactivar "${it.titulo}"?`)) return;
    await eliminarItem(it.id);
    await onChanged();
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await upsertItem({ ...editing, flujo });
    setEditing(null);
    await onChanged();
  }

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Catálogo de items · ${flujo}`}
      size="lg"
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button
            onClick={() =>
              setEditing({ flujo, orden: items.length * 10 + 10, titulo: '', obligatorio: true })
            }
          >
            <Plus size={14} /> Nuevo item
          </Button>
        </div>

        <div className="overflow-hidden rounded border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>
                <th className="w-16 px-3 py-2">Orden</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Obligatorio</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Sin items.
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 tabular-nums">{it.orden}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.titulo}</div>
                    {it.descripcion && (
                      <div className="text-xs text-slate-500">{it.descripcion}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {it.obligatorio ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Sí
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onBorrar(it)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <form onSubmit={onSave} className="rounded border border-brand-200 bg-brand-50 p-3 flex flex-col gap-3">
            <div className="text-sm font-semibold text-brand-700">
              {editing.id ? 'Editar item' : 'Nuevo item'}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Orden"
                type="number"
                value={editing.orden ?? 100}
                onChange={(e) => setEditing({ ...editing, orden: Number(e.target.value) })}
              />
              <Input
                label="Título *"
                required
                className="col-span-2"
                value={editing.titulo ?? ''}
                onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
              />
            </div>
            <Input
              label="Descripción"
              value={editing.descripcion ?? ''}
              onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.obligatorio ?? true}
                onChange={(e) => setEditing({ ...editing, obligatorio: e.target.checked })}
              />
              Obligatorio
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar item</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

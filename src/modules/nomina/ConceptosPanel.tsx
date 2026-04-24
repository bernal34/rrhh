import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import {
  ConceptoNomina,
  listConceptos,
  toggleConcepto,
  upsertConcepto,
} from '@/services/conceptosService';

export default function ConceptosPanel() {
  const [items, setItems] = useState<ConceptoNomina[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConceptoNomina | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await listConceptos(false));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={16} /> Nuevo concepto
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Clave</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cálculo</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Activo</th>
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
            {items.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => {
                  setEditing(c);
                  setOpen(true);
                }}
              >
                <td className="px-4 py-2 font-mono text-xs">{c.clave}</td>
                <td className="px-4 py-2 font-medium">{c.nombre}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.tipo === 'percepcion'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {c.tipo}
                  </span>
                </td>
                <td className="px-4 py-2">{c.calculo}</td>
                <td className="px-4 py-2 tabular-nums">{c.valor ?? '—'}</td>
                <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={c.activo}
                    onChange={async (e) => {
                      await toggleConcepto(c.id, e.target.checked);
                      await load();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConceptoForm
        open={open}
        onClose={() => setOpen(false)}
        concepto={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function ConceptoForm({
  open,
  onClose,
  concepto,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  concepto: ConceptoNomina | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<ConceptoNomina>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        concepto ?? {
          tipo: 'percepcion',
          calculo: 'fijo',
          valor: 0,
          grava_isr: false,
          grava_imss: false,
          activo: true,
          orden: 100,
        },
      );
    }
  }, [open, concepto]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertConcepto(form);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={concepto ? 'Editar concepto' : 'Nuevo concepto'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Clave *"
            required
            value={form.clave ?? ''}
            onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase() })}
          />
          <Input
            label="Orden"
            type="number"
            value={form.orden ?? 100}
            onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            options={[
              { value: 'percepcion', label: 'Percepción' },
              { value: 'deduccion', label: 'Deducción' },
            ]}
            value={form.tipo ?? 'percepcion'}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as ConceptoNomina['tipo'] })}
          />
          <Select
            label="Cálculo"
            options={[
              { value: 'fijo', label: 'Fijo' },
              { value: 'porcentaje', label: 'Porcentaje' },
              { value: 'formula', label: 'Fórmula' },
              { value: 'automatico', label: 'Automático' },
            ]}
            value={form.calculo ?? 'fijo'}
            onChange={(e) =>
              setForm({ ...form, calculo: e.target.value as ConceptoNomina['calculo'] })
            }
          />
        </div>
        <Input
          label="Valor"
          type="number"
          step="0.01"
          value={form.valor ?? 0}
          onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
        />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.grava_isr}
              onChange={(e) => setForm({ ...form, grava_isr: e.target.checked })}
            />
            Grava ISR
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.grava_imss}
              onChange={(e) => setForm({ ...form, grava_imss: e.target.checked })}
            />
            Grava IMSS
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            Activo
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-3">
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

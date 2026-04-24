import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useCatalogos } from '@/hooks/useCatalogos';
import { useAuth } from '@/lib/auth';
import {
  ReglaBono,
  listReglasBono,
  toggleReglaBono,
  upsertReglaBono,
} from '@/services/reglasBonoService';
import { ConceptoNomina, listConceptos } from '@/services/conceptosService';

export default function BonosPanel() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('nomina');
  const [items, setItems] = useState<ReglaBono[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReglaBono | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await listReglasBono(false));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

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
            <Plus size={16} /> Nueva regla de bono
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Umbral</th>
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
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin reglas de bono.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-slate-100 ${
                  editar ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
                onClick={() => {
                  if (!editar) return;
                  setEditing(r);
                  setOpen(true);
                }}
              >
                <td className="px-4 py-2 font-medium">{r.nombre}</td>
                <td className="px-4 py-2">{r.concepto?.nombre ?? '—'}</td>
                <td className="px-4 py-2 capitalize">{r.tipo}</td>
                <td className="px-4 py-2 tabular-nums">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(r.monto)}
                </td>
                <td className="px-4 py-2">
                  {r.tipo === 'puntualidad' && `≤ ${r.max_retardos_permitidos ?? 0} retardos`}
                  {r.tipo === 'asistencia' && `≤ ${r.max_faltas_permitidas ?? 0} faltas`}
                  {r.tipo === 'fijo' && 'Siempre'}
                </td>
                <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={r.activo}
                    disabled={!editar}
                    onChange={async (e) => {
                      await toggleReglaBono(r.id, e.target.checked);
                      await load();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReglaForm
        open={open}
        onClose={() => setOpen(false)}
        regla={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function ReglaForm({
  open,
  onClose,
  regla,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  regla: ReglaBono | null;
  onSaved: () => void;
}) {
  const { sucursales } = useCatalogos();
  const [conceptos, setConceptos] = useState<ConceptoNomina[]>([]);
  const [form, setForm] = useState<Partial<ReglaBono>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        regla ?? {
          tipo: 'puntualidad',
          monto: 0,
          max_retardos_permitidos: 0,
          max_faltas_permitidas: 0,
          activo: true,
        },
      );
      listConceptos(true).then((c) => setConceptos(c.filter((x) => x.tipo === 'percepcion')));
    }
  }, [open, regla]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertReglaBono(form);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={regla ? 'Editar regla' : 'Nueva regla de bono'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <Select
          label="Concepto (percepción) *"
          required
          placeholder="Selecciona un concepto"
          options={conceptos.map((c) => ({ value: c.id, label: c.nombre }))}
          value={form.concepto_id ?? ''}
          onChange={(e) => setForm({ ...form, concepto_id: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            options={[
              { value: 'puntualidad', label: 'Puntualidad (≤ N retardos)' },
              { value: 'asistencia', label: 'Asistencia (≤ N faltas)' },
              { value: 'fijo', label: 'Fijo (siempre)' },
            ]}
            value={form.tipo ?? 'puntualidad'}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as ReglaBono['tipo'] })}
          />
          <Input
            label="Monto *"
            type="number"
            step="0.01"
            required
            value={form.monto ?? 0}
            onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
          />
        </div>
        {form.tipo === 'puntualidad' && (
          <Input
            label="Retardos máximos permitidos"
            type="number"
            min={0}
            value={form.max_retardos_permitidos ?? 0}
            onChange={(e) =>
              setForm({ ...form, max_retardos_permitidos: Number(e.target.value) })
            }
          />
        )}
        {form.tipo === 'asistencia' && (
          <Input
            label="Faltas máximas permitidas"
            type="number"
            min={0}
            value={form.max_faltas_permitidas ?? 0}
            onChange={(e) =>
              setForm({ ...form, max_faltas_permitidas: Number(e.target.value) })
            }
          />
        )}
        <Select
          label="Aplica a sucursal"
          placeholder="Todas"
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          value={form.aplica_sucursal_id ?? ''}
          onChange={(e) =>
            setForm({ ...form, aplica_sucursal_id: e.target.value || null })
          }
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
          Activo
        </label>
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

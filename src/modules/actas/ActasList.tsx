import { FormEvent, useEffect, useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import {
  Acta,
  TipoActa,
  listActas,
  subirDocumentoActa,
  tipoActaLabel,
  upsertActa,
} from '@/services/actasService';
import { Empleado, listEmpleados } from '@/services/empleadosService';

const tipoColor: Record<TipoActa, string> = {
  amonestacion_verbal: 'bg-slate-100 text-slate-700',
  amonestacion_escrita: 'bg-yellow-100 text-yellow-700',
  acta_administrativa: 'bg-orange-100 text-orange-700',
  suspension: 'bg-red-100 text-red-700',
  rescision: 'bg-red-200 text-red-800',
};

export default function ActasList() {
  const [rows, setRows] = useState<Acta[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tipoF, setTipoF] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRows(await listActas({ tipo: (tipoF || undefined) as TipoActa | undefined }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoF]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actas administrativas</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Nueva acta
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <Select
          className="max-w-xs"
          placeholder="Todos los tipos"
          options={(Object.keys(tipoActaLabel) as TipoActa[]).map((t) => ({
            value: t,
            label: tipoActaLabel[t],
          }))}
          value={tipoF}
          onChange={(e) => setTipoF(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Hechos</th>
              <th className="px-4 py-3">Firmada</th>
              <th className="px-4 py-3">Doc</th>
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
                  Sin actas.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{a.folio}</td>
                <td className="px-4 py-2 font-medium">
                  {a.empleado
                    ? `${a.empleado.nombre} ${a.empleado.apellido_paterno ?? ''}`.trim()
                    : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipoColor[a.tipo]}`}
                  >
                    {tipoActaLabel[a.tipo]}
                  </span>
                </td>
                <td className="px-4 py-2">{a.fecha}</td>
                <td className="px-4 py-2 max-w-md truncate">{a.hechos}</td>
                <td className="px-4 py-2">
                  {a.firmada_por_empleado
                    ? '✓'
                    : a.negado_firmar
                    ? 'Negó firmar'
                    : 'Pendiente'}
                </td>
                <td className="px-4 py-2">
                  {a.documento_path ? <FileText size={14} className="text-brand-600" /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActaForm
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

function ActaForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [form, setForm] = useState<Partial<Acta>>({});
  const [file, setFile] = useState<File | null>(null);
  const [testigos, setTestigos] = useState<Array<{ nombre: string; puesto?: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        tipo: 'amonestacion_escrita',
        fecha: new Date().toISOString().slice(0, 10),
        hechos: '',
      });
      setTestigos([]);
      setFile(null);
      listEmpleados({ estatus: 'activo' }).then(setEmpleados);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await upsertActa({ ...form, testigos });
      if (file) await subirDocumentoActa(saved.id, file);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  function addTestigo() {
    setTestigos([...testigos, { nombre: '' }]);
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva acta administrativa" size="xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
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
            options={(Object.keys(tipoActaLabel) as TipoActa[]).map((t) => ({
              value: t,
              label: tipoActaLabel[t],
            }))}
            value={form.tipo ?? 'amonestacion_escrita'}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoActa })}
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
            label="Hora"
            type="time"
            value={form.hora ?? ''}
            onChange={(e) => setForm({ ...form, hora: e.target.value })}
          />
          <Input
            label="Lugar"
            value={form.lugar ?? ''}
            onChange={(e) => setForm({ ...form, lugar: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Hechos *</label>
          <textarea
            required
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            value={form.hechos ?? ''}
            onChange={(e) => setForm({ ...form, hechos: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Artículo / cláusula"
            value={form.articulo_infringido ?? ''}
            onChange={(e) => setForm({ ...form, articulo_infringido: e.target.value })}
          />
          <Input
            label="Consecuencia"
            value={form.consecuencia ?? ''}
            onChange={(e) => setForm({ ...form, consecuencia: e.target.value })}
          />
        </div>
        {form.tipo === 'suspension' && (
          <Input
            label="Días de suspensión"
            type="number"
            min={1}
            value={form.dias_suspension ?? ''}
            onChange={(e) =>
              setForm({ ...form, dias_suspension: Number(e.target.value) || null })
            }
          />
        )}
        <div>
          <label className="text-sm font-medium text-slate-700">Testigos</label>
          <div className="mt-1 flex flex-col gap-2">
            {testigos.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Nombre"
                  value={t.nombre}
                  onChange={(e) => {
                    const next = [...testigos];
                    next[idx] = { ...next[idx], nombre: e.target.value };
                    setTestigos(next);
                  }}
                />
                <input
                  className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Puesto"
                  value={t.puesto ?? ''}
                  onChange={(e) => {
                    const next = [...testigos];
                    next[idx] = { ...next[idx], puesto: e.target.value };
                    setTestigos(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTestigos(testigos.filter((_, i) => i !== idx))}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addTestigo}>
              + Agregar testigo
            </Button>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.firmada_por_empleado}
              onChange={(e) => setForm({ ...form, firmada_por_empleado: e.target.checked })}
            />
            Firmada por el empleado
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.negado_firmar}
              onChange={(e) => setForm({ ...form, negado_firmar: e.target.checked })}
            />
            Negó firmar
          </label>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Adjuntar PDF del acta (opcional)
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Registrar acta
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Heart, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Empleado, listEmpleados } from '@/services/empleadosService';

type Aplicacion = {
  id: string;
  empleado_id: string;
  fecha: string;
  guia: 'I' | 'II' | 'III';
  puntaje_total: number | null;
  nivel_riesgo: 'nulo' | 'bajo' | 'medio' | 'alto' | 'muy_alto' | null;
  acciones: string | null;
  notas: string | null;
  empleado?: { nombre: string; apellido_paterno: string | null };
};

const nivelColor: Record<string, string> = {
  nulo: 'bg-green-100 text-green-700',
  bajo: 'bg-emerald-100 text-emerald-700',
  medio: 'bg-yellow-100 text-yellow-700',
  alto: 'bg-orange-100 text-orange-700',
  muy_alto: 'bg-red-100 text-red-700',
};

const guiaInfo = {
  I: 'Hasta 15 colaboradores · cuestionario corto',
  II: 'De 16 a 50 colaboradores · cuestionario completo',
  III: 'Más de 50 colaboradores · cuestionario completo + entorno',
};

export default function Nom035Page() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('nom035');
  const [rows, setRows] = useState<Aplicacion[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [rRes, eRes] = await Promise.all([
        supabase
          .from('nom035_aplicaciones')
          .select('*, empleado:empleados(nombre, apellido_paterno)')
          .order('fecha', { ascending: false }),
        listEmpleados({ estatus: 'activo' }),
      ]);
      setRows((rRes.data ?? []) as Aplicacion[]);
      setEmpleados(eRes);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const altos = rows.filter((r) => r.nivel_riesgo === 'alto' || r.nivel_riesgo === 'muy_alto').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Heart className="text-pink-600" /> NOM-035 STPS
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Identificación, análisis y prevención de factores de riesgo psicosocial.
          </p>
        </div>
        {editar && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Registrar aplicación
          </Button>
        )}
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <b>Cuestionarios oficiales STPS:</b>
            <ul className="mt-1 ml-4 list-disc">
              <li>
                <a className="underline" href="https://www.gob.mx/cms/uploads/attachment/file/503381/CuestionarioReferencia1.pdf" target="_blank" rel="noreferrer">
                  Guía I (≤15 colaboradores)
                </a>
              </li>
              <li>
                <a className="underline" href="https://www.gob.mx/cms/uploads/attachment/file/503382/CuestionarioReferencia2.pdf" target="_blank" rel="noreferrer">
                  Guía II (16–50)
                </a>
              </li>
              <li>
                <a className="underline" href="https://www.gob.mx/cms/uploads/attachment/file/503383/CuestionarioReferencia3.pdf" target="_blank" rel="noreferrer">
                  Guía III (≥50)
                </a>
              </li>
            </ul>
            Aplica el cuestionario en papel/digital y captura aquí el resultado.
          </div>
        </div>
      </div>

      {altos > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          ⚠️ <b>{altos}</b> empleado{altos === 1 ? '' : 's'} con riesgo alto/muy alto requieren intervención.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Guía</th>
              <th className="px-4 py-3 text-right">Puntaje</th>
              <th className="px-4 py-3">Nivel de riesgo</th>
              <th className="px-4 py-3">Acciones</th>
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
                  Sin aplicaciones registradas.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">
                  {r.empleado
                    ? `${r.empleado.nombre} ${r.empleado.apellido_paterno ?? ''}`.trim()
                    : '—'}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.fecha}</td>
                <td className="px-4 py-2">Guía {r.guia}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.puntaje_total ?? '—'}</td>
                <td className="px-4 py-2">
                  {r.nivel_riesgo ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${nivelColor[r.nivel_riesgo]}`}>
                      {r.nivel_riesgo.replace('_', ' ')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600 max-w-md truncate">
                  {r.acciones ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AplicacionForm
        open={open}
        empleados={empleados}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function AplicacionForm({
  open,
  empleados,
  onClose,
  onSaved,
}: {
  open: boolean;
  empleados: Empleado[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<{
    empleado_id: string;
    fecha: string;
    guia: 'I' | 'II' | 'III';
    puntaje_total: string;
    nivel_riesgo: '' | 'nulo' | 'bajo' | 'medio' | 'alto' | 'muy_alto';
    acciones: string;
    notas: string;
  }>({
    empleado_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    guia: 'II',
    puntaje_total: '',
    nivel_riesgo: '',
    acciones: '',
    notas: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        empleado_id: '',
        fecha: new Date().toISOString().slice(0, 10),
        guia: 'II',
        puntaje_total: '',
        nivel_riesgo: '',
        acciones: '',
        notas: '',
      });
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('nom035_aplicaciones').insert({
        empleado_id: form.empleado_id,
        fecha: form.fecha,
        guia: form.guia,
        puntaje_total: form.puntaje_total ? Number(form.puntaje_total) : null,
        nivel_riesgo: form.nivel_riesgo || null,
        acciones: form.acciones || null,
        notas: form.notas || null,
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva aplicación NOM-035" size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Empleado *"
          required
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
          }))}
          value={form.empleado_id}
          onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha *"
            type="date"
            required
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          />
          <Select
            label="Guía aplicada *"
            options={[
              { value: 'I', label: 'Guía I (≤15)' },
              { value: 'II', label: 'Guía II (16-50)' },
              { value: 'III', label: 'Guía III (≥50)' },
            ]}
            value={form.guia}
            onChange={(e) => setForm({ ...form, guia: e.target.value as 'I' | 'II' | 'III' })}
          />
        </div>
        <div className="text-xs text-slate-500">{guiaInfo[form.guia]}</div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Puntaje total"
            type="number"
            value={form.puntaje_total}
            onChange={(e) => setForm({ ...form, puntaje_total: e.target.value })}
          />
          <Select
            label="Nivel de riesgo"
            placeholder="—"
            options={[
              { value: 'nulo', label: 'Nulo' },
              { value: 'bajo', label: 'Bajo' },
              { value: 'medio', label: 'Medio' },
              { value: 'alto', label: 'Alto' },
              { value: 'muy_alto', label: 'Muy alto' },
            ]}
            value={form.nivel_riesgo}
            onChange={(e) =>
              setForm({ ...form, nivel_riesgo: e.target.value as typeof form.nivel_riesgo })
            }
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Acciones implementadas</label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            rows={3}
            value={form.acciones}
            onChange={(e) => setForm({ ...form, acciones: e.target.value })}
            placeholder="Plan de intervención, capacitación, atención psicológica…"
          />
        </div>
        <Input label="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!form.empleado_id}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type SueldoRow = {
  id: string;
  empleado_id: string;
  sueldo_diario: number;
  sueldo_mensual: number;
  tipo_pago: 'semanal' | 'quincenal' | 'mensual';
  vigente_desde: string;
  vigente_hasta: string | null;
  nota: string | null;
};

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export default function EmpleadoSueldosPanel({ empleadoId }: { empleadoId: string }) {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('empleados') || puedeEditar('nomina');
  const [rows, setRows] = useState<SueldoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    sueldo_diario: '',
    tipo_pago: 'quincenal' as 'semanal' | 'quincenal' | 'mensual',
    vigente_desde: new Date().toISOString().slice(0, 10),
    nota: '',
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('empleado_sueldo')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('vigente_desde', { ascending: false });
    setRows((data ?? []) as SueldoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      // Cierra el sueldo vigente (vigente_hasta = nueva fecha - 1 día)
      const yesterday = new Date(form.vigente_desde + 'T00:00:00');
      yesterday.setDate(yesterday.getDate() - 1);
      const cierre = yesterday.toISOString().slice(0, 10);
      await supabase
        .from('empleado_sueldo')
        .update({ vigente_hasta: cierre })
        .eq('empleado_id', empleadoId)
        .is('vigente_hasta', null);

      const { error } = await supabase.from('empleado_sueldo').insert({
        empleado_id: empleadoId,
        sueldo_diario: Number(form.sueldo_diario),
        tipo_pago: form.tipo_pago,
        vigente_desde: form.vigente_desde,
        nota: form.nota || null,
      });
      if (error) throw error;
      setForm({
        sueldo_diario: '',
        tipo_pago: form.tipo_pago,
        vigente_desde: new Date().toISOString().slice(0, 10),
        nota: '',
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  const actual = rows.find((r) => !r.vigente_hasta);

  return (
    <div className="flex flex-col gap-4">
      {actual && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-700">
            <TrendingUp size={14} /> Sueldo vigente
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Diario</div>
              <div className="font-semibold tabular-nums">{fmt.format(actual.sueldo_diario)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Mensual (×30)</div>
              <div className="font-semibold tabular-nums">{fmt.format(actual.sueldo_mensual)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Tipo de pago</div>
              <div className="font-semibold capitalize">{actual.tipo_pago}</div>
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Vigente desde {actual.vigente_desde}
          </div>
        </div>
      )}

      {editar && (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Plus size={14} /> Registrar nuevo sueldo
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              label="Sueldo diario *"
              type="number"
              step="0.01"
              min={0}
              required
              value={form.sueldo_diario}
              onChange={(e) => setForm({ ...form, sueldo_diario: e.target.value })}
            />
            <Select
              label="Tipo de pago"
              options={[
                { value: 'semanal', label: 'Semanal' },
                { value: 'quincenal', label: 'Quincenal' },
                { value: 'mensual', label: 'Mensual' },
              ]}
              value={form.tipo_pago}
              onChange={(e) => setForm({ ...form, tipo_pago: e.target.value as 'semanal' | 'quincenal' | 'mensual' })}
            />
            <Input
              label="Vigente desde *"
              type="date"
              required
              value={form.vigente_desde}
              onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })}
            />
          </div>
          <Input
            label="Nota (motivo del cambio, ej. aumento anual)"
            value={form.nota}
            onChange={(e) => setForm({ ...form, nota: e.target.value })}
          />
          {form.sueldo_diario && (
            <div className="text-xs text-slate-500">
              Mensual proyectado: <b>{fmt.format(Number(form.sueldo_diario) * 30)}</b>
            </div>
          )}
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={!form.sueldo_diario}>
              Guardar sueldo
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
          Histórico de sueldos
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-2">Vigente desde</th>
              <th className="px-4 py-2">Vigente hasta</th>
              <th className="px-4 py-2 text-right">Diario</th>
              <th className="px-4 py-2 text-right">Mensual</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Nota</th>
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
                  Sin sueldos registrados.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.vigente_desde}</td>
                <td className="px-4 py-2 text-slate-600">{r.vigente_hasta ?? 'Vigente'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.sueldo_diario)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {fmt.format(r.sueldo_mensual)}
                </td>
                <td className="px-4 py-2 capitalize">{r.tipo_pago}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{r.nota ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        El <b>sueldo mensual</b> se calcula automáticamente como <code>diario × 30</code>.
        Al registrar un nuevo sueldo, el anterior se cierra automáticamente con la fecha
        del día previo.
      </div>
    </div>
  );
}

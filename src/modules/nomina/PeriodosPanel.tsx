import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import {
  Periodo,
  PeriodoConPrenominas,
  crearPeriodo,
  eliminarPeriodo,
  listPeriodosConPrenominas,
} from '@/services/nominaService';

const estatusBadge: Record<string, string> = {
  abierto: 'bg-blue-100 text-blue-700',
  calculado: 'bg-yellow-100 text-yellow-700',
  pagado: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-600',
};

const prenoColor: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  en_revision: 'bg-yellow-100 text-yellow-700',
  autorizada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  convertida: 'bg-blue-100 text-blue-700',
};

export default function PeriodosPanel() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('nomina');
  const [rows, setRows] = useState<PeriodoConPrenominas[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await listPeriodosConPrenominas());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onBorrar(p: PeriodoConPrenominas) {
    const detalles = p.prenominas.length;
    const msg =
      detalles > 0
        ? `¿Eliminar el periodo ${p.fecha_inicio} → ${p.fecha_fin}?\n\nEsto borrará también ${detalles} prenómina(s) (incluyendo borradores y canceladas) y todos sus detalles. Esta acción es IRREVERSIBLE.`
        : `¿Eliminar el periodo ${p.fecha_inicio} → ${p.fecha_fin}?`;
    if (!confirm(msg)) return;
    try {
      await eliminarPeriodo(p.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {rows.length} periodos registrados.
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refrescar
          </Button>
          {editar && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Nuevo periodo
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3">Prenóminas</th>
              <th className="px-4 py-3 text-right">Acciones</th>
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
                  Sin periodos registrados.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const tieneAutorizada = p.prenominas.some(
                (x) => x.estatus === 'autorizada' || x.estatus === 'convertida',
              );
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 capitalize font-medium text-slate-800">{p.tipo}</td>
                  <td className="px-4 py-2 text-slate-700">{p.fecha_inicio}</td>
                  <td className="px-4 py-2 text-slate-700">{p.fecha_fin}</td>
                  <td className="px-4 py-2 text-slate-600">{p.fecha_pago ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estatusBadge[p.estatus] ?? ''}`}>
                      {p.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {p.prenominas.length === 0 ? (
                      <span className="text-xs text-slate-400">Sin prenóminas</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.prenominas.map((pr) => (
                          <span
                            key={pr.id}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${prenoColor[pr.estatus] ?? ''}`}
                            title={`${pr.num_empleados} empleados`}
                          >
                            {pr.estatus} ({pr.num_empleados})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onBorrar(p)}
                        disabled={tieneAutorizada}
                        title={
                          tieneAutorizada
                            ? 'No se puede eliminar: hay prenómina autorizada o convertida'
                            : 'Eliminar periodo'
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PeriodoModal
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

function PeriodoModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Periodo>>({ tipo: 'quincenal' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ tipo: 'quincenal' });
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await crearPeriodo(form);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo periodo de nómina">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Tipo"
          options={[
            { value: 'semanal', label: 'Semanal' },
            { value: 'quincenal', label: 'Quincenal' },
            { value: 'mensual', label: 'Mensual' },
          ]}
          value={form.tipo ?? 'quincenal'}
          onChange={(e) => setForm({ ...form, tipo: e.target.value as Periodo['tipo'] })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Inicio *"
            type="date"
            required
            value={form.fecha_inicio ?? ''}
            onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
          />
          <Input
            label="Fin *"
            type="date"
            required
            value={form.fecha_fin ?? ''}
            onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
          />
        </div>
        <Input
          label="Fecha de pago"
          type="date"
          value={form.fecha_pago ?? ''}
          onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Crear
          </Button>
        </div>
      </form>
    </Modal>
  );
}

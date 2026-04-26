import { useEffect, useState } from 'react';
import { Check, X, FileText, Send, Plus, Trash2, FileBarChart } from 'lucide-react';
import { abrirPrenominaPdf, abrirResumenAnualPdf } from '@/lib/nominaPdf';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useCatalogos } from '@/hooks/useCatalogos';
import { useAuth } from '@/lib/auth';
import {
  Periodo,
  Prenomina,
  autorizarPrenomina,
  cancelarPrenomina,
  crearPeriodo,
  eliminarPrenomina,
  enviarARevision,
  generarPrenomina,
  listPeriodos,
  listPrenominas,
} from '@/services/nominaService';
import PrenominaDetalle from './PrenominaDetalle';

const estatusColor: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  en_revision: 'bg-yellow-100 text-yellow-700',
  autorizada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  convertida: 'bg-blue-100 text-blue-700',
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

export default function NominaList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('nomina');
  const [prenominas, setPrenominas] = useState<Prenomina[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalGen, setModalGen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPrenominas(await listPrenominas());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nómina y prenómina</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => abrirResumenAnualPdf(new Date().getFullYear())}
            title="Resumen anual de nómina"
          >
            <FileBarChart size={14} /> Resumen anual
          </Button>
          {editar && (
            <>
              <Button variant="secondary" onClick={() => setModalPeriodo(true)}>
                <Plus size={16} /> Nuevo periodo
              </Button>
              <Button onClick={() => setModalGen(true)}>
                <FileText size={16} /> Generar prenómina
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3">Empleados</th>
              <th className="px-4 py-3">Percepciones</th>
              <th className="px-4 py-3">Deducciones</th>
              <th className="px-4 py-3">Neto</th>
              <th className="px-4 py-3">Estatus</th>
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
            {!loading && prenominas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Aún no has generado prenóminas.
                </td>
              </tr>
            )}
            {prenominas.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">
                    {p.periodo
                      ? `${p.periodo.fecha_inicio} → ${p.periodo.fecha_fin}`
                      : '—'}
                  </div>
                  <div className="text-xs text-slate-500">{p.periodo?.tipo}</div>
                </td>
                <td className="px-4 py-3">{p.num_empleados}</td>
                <td className="px-4 py-3 tabular-nums">{fmtMoney(p.total_percepciones)}</td>
                <td className="px-4 py-3 tabular-nums">{fmtMoney(p.total_deducciones)}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(p.total_neto)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      estatusColor[p.estatus] ?? ''
                    }`}
                  >
                    {p.estatus.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetalleId(p.id)}>
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirPrenominaPdf(p.id)}
                      title="PDF reporte de prenómina"
                    >
                      <FileText size={14} />
                    </Button>
                    {editar && p.estatus === 'borrador' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => accion(() => enviarARevision(p.id))}
                      >
                        <Send size={14} /> Enviar
                      </Button>
                    )}
                    {editar &&
                      (p.estatus === 'borrador' || p.estatus === 'en_revision') && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => accion(() => autorizarPrenomina(p.id))}
                          >
                            <Check size={14} /> Autorizar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const m = prompt('Motivo de cancelación:');
                              if (m) accion(() => cancelarPrenomina(p.id, m));
                            }}
                            title="Cancelar"
                          >
                            <X size={14} />
                          </Button>
                        </>
                      )}
                    {editar && p.estatus !== 'autorizada' && p.estatus !== 'convertida' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar PERMANENTEMENTE la prenómina del periodo ${
                                p.periodo
                                  ? `${p.periodo.fecha_inicio} → ${p.periodo.fecha_fin}`
                                  : ''
                              }? Esta acción borra todos sus detalles y no se puede deshacer.`,
                            )
                          ) {
                            accion(() => eliminarPrenomina(p.id));
                          }
                        }}
                        title="Eliminar prenómina"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PeriodoModal open={modalPeriodo} onClose={() => setModalPeriodo(false)} onSaved={load} />
      <GenerarPrenominaModal
        open={modalGen}
        onClose={() => setModalGen(false)}
        onSaved={load}
      />
      <PrenominaDetalle
        prenominaId={detalleId}
        onClose={() => setDetalleId(null)}
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await crearPeriodo(form);
      onSaved();
      onClose();
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

function GenerarPrenominaModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sucursales } = useCatalogos();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) listPeriodos().then(setPeriodos);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await generarPrenomina(periodoId, sucursalId || undefined);
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar prenómina">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Recalcula asistencia del periodo y arma la prenómina en estatus <b>borrador</b>.
        </p>
        <Select
          label="Periodo *"
          required
          placeholder="Selecciona un periodo"
          options={periodos.map((p) => ({
            value: p.id,
            label: `${p.tipo} — ${p.fecha_inicio} → ${p.fecha_fin}`,
          }))}
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
        />
        <Select
          label="Sucursal"
          placeholder="Todas"
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!periodoId}>
            Generar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

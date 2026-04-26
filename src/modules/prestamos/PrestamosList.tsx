import { FormEvent, useEffect, useState } from 'react';
import { Plus, DollarSign, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Empleado, listEmpleados } from '@/services/empleadosService';

type Prestamo = {
  id: string;
  empleado_id: string;
  monto_total: number;
  num_pagos: number;
  monto_por_pago: number;
  fecha_inicio: string;
  motivo: string | null;
  estatus: 'activo' | 'liquidado' | 'cancelado';
  pagado: number;
  saldo: number;
};

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const estatusColor: Record<string, string> = {
  activo: 'bg-blue-100 text-blue-700',
  liquidado: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-600',
};

export default function PrestamosList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('prestamos');
  const [rows, setRows] = useState<Prestamo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pago, setPago] = useState<Prestamo | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [pRes, eRes] = await Promise.all([
        supabase
          .from('prestamos_con_saldo')
          .select(
            'id, empleado_id, monto_total, num_pagos, monto_por_pago, fecha_inicio, motivo, estatus, pagado, saldo, empleado:empleados(nombre, apellido_paterno, codigo)',
          )
          .order('fecha_inicio', { ascending: false }),
        listEmpleados({ estatus: 'activo' }),
      ]);
      setRows((pRes.data ?? []) as any);
      setEmpleados(eRes);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const empById = new Map(empleados.map((e) => [e.id, e]));

  const totalActivo = rows.filter((r) => r.estatus === 'activo').reduce((a, r) => a + Number(r.saldo), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <DollarSign className="text-brand-600" /> Préstamos a empleados
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Saldo activo total: <b className="text-brand-700">{fmt.format(totalActivo)}</b>
          </p>
        </div>
        {editar && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Nuevo préstamo
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Pagos</th>
              <th className="px-4 py-3 text-right">Por pago</th>
              <th className="px-4 py-3 text-right">Pagado</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Sin préstamos registrados.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const emp = empById.get(r.empleado_id) ?? (r as any).empleado;
              const nombre = emp ? `${emp.nombre} ${emp.apellido_paterno ?? ''}`.trim() : '—';
              return (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{nombre}</div>
                    {r.motivo && <div className="text-xs text-slate-500">{r.motivo}</div>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.fecha_inicio}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.monto_total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.num_pagos}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.monto_por_pago)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-700">
                    {fmt.format(r.pagado)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-brand-700">
                    {fmt.format(r.saldo)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${estatusColor[r.estatus]}`}
                    >
                      {r.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editar && r.estatus === 'activo' && (
                      <Button variant="ghost" size="sm" onClick={() => setPago(r)}>
                        <Check size={14} /> Registrar pago
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PrestamoForm
        open={open}
        empleados={empleados}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
      <PagoForm
        prestamo={pago}
        onClose={() => setPago(null)}
        onSaved={() => {
          setPago(null);
          void load();
        }}
      />
    </div>
  );
}

function PrestamoForm({
  open,
  onClose,
  empleados,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  empleados: Empleado[];
  onSaved: () => void;
}) {
  const [empleadoId, setEmpleadoId] = useState('');
  const [monto, setMonto] = useState('');
  const [numPagos, setNumPagos] = useState('1');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmpleadoId('');
      setMonto('');
      setNumPagos('1');
      setFecha(new Date().toISOString().slice(0, 10));
      setMotivo('');
      setErr(null);
    }
  }, [open]);

  const montoPorPago =
    Number(monto) > 0 && Number(numPagos) > 0 ? Number(monto) / Number(numPagos) : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.from('prestamos').insert({
        empleado_id: empleadoId,
        monto_total: Number(monto),
        num_pagos: Number(numPagos),
        monto_por_pago: montoPorPago,
        fecha_inicio: fecha,
        motivo: motivo || null,
        estatus: 'activo',
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo préstamo">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Empleado *"
          required
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
          }))}
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto total *"
            type="number"
            step="0.01"
            min={0}
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <Input
            label="Número de pagos *"
            type="number"
            min={1}
            required
            value={numPagos}
            onChange={(e) => setNumPagos(e.target.value)}
          />
        </div>
        <Input
          label="Fecha de inicio"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
          Pago por periodo: <b className="tabular-nums">{fmt.format(montoPorPago)}</b>
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!empleadoId || !monto}>
            Crear
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PagoForm({
  prestamo,
  onClose,
  onSaved,
}: {
  prestamo: Prestamo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prestamo) {
      setMonto(String(prestamo.monto_por_pago));
      setFecha(new Date().toISOString().slice(0, 10));
      setNotas('');
    }
  }, [prestamo]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestamo) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('prestamo_pagos').insert({
        prestamo_id: prestamo.id,
        fecha,
        monto: Number(monto),
        notas: notas || null,
      });
      if (error) throw error;
      // Si saldo nuevo <= 0, marcar liquidado
      const nuevoPagado = Number(prestamo.pagado) + Number(monto);
      if (nuevoPagado >= Number(prestamo.monto_total)) {
        await supabase.from('prestamos').update({ estatus: 'liquidado' }).eq('id', prestamo.id);
      }
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  if (!prestamo) return null;

  return (
    <Modal open onClose={onClose} title="Registrar pago">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            Saldo actual: <b className="tabular-nums">{fmt.format(prestamo.saldo)}</b>
          </div>
          <div className="text-xs text-slate-500">
            Pago sugerido: {fmt.format(prestamo.monto_por_pago)}
          </div>
        </div>
        <Input
          label="Monto del pago *"
          type="number"
          step="0.01"
          min={0}
          required
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <Input label="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            <X size={14} /> Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!monto}>
            Guardar pago
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { Calendar, Clock, FileText, Palmtree, Plus, User, DollarSign, AlertCircle } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';

type Perfil = {
  id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  codigo: string | null;
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  fecha_ingreso: string;
  email: string | null;
  telefono: string | null;
  foto_url: string | null;
  puesto_nombre: string | null;
  sucursal_nombre: string | null;
  empresa_nombre: string | null;
  empresa_logo: string | null;
};

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export default function MiPortal() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('mi_perfil')
      .select('*')
      .maybeSingle()
      .then(({ data }: any) => {
        setPerfil(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="py-16 text-center text-slate-500">Cargando…</div>;

  if (!perfil) {
    return (
      <EmptyState
        icon={User}
        title="Tu cuenta aún no está vinculada a un empleado"
        description="Pide a Recursos Humanos que te asocie a tu ficha de empleado desde el módulo de Empleados (campo 'Cuenta asociada')."
      />
    );
  }

  const nombre = [perfil.nombre, perfil.apellido_paterno, perfil.apellido_materno]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <Avatar src={perfil.foto_url ?? undefined} name={perfil.nombre} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{nombre}</h1>
          <div className="text-sm text-slate-600">
            {perfil.puesto_nombre ?? 'Sin puesto'}
            {perfil.sucursal_nombre ? ` · ${perfil.sucursal_nombre}` : ''}
            {perfil.empresa_nombre ? ` · ${perfil.empresa_nombre}` : ''}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {perfil.codigo ? `Código ${perfil.codigo} · ` : ''}
            Ingreso {new Date(perfil.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
        {perfil.empresa_logo && (
          <img src={perfil.empresa_logo} className="h-12 max-w-[120px] object-contain" alt="" />
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'datos', label: 'Mis datos', content: <DatosTab perfil={perfil} /> },
          { key: 'checadas', label: 'Mis checadas', content: <ChecadasTab /> },
          { key: 'asistencia', label: 'Mi asistencia', content: <AsistenciaTab /> },
          { key: 'vacaciones', label: 'Mis vacaciones', content: <VacacionesTab /> },
          { key: 'incidencias', label: 'Mis solicitudes', content: <IncidenciasTab /> },
          { key: 'recibos', label: 'Mis recibos', content: <RecibosTab /> },
          { key: 'docs', label: 'Mis documentos', content: <DocsTab /> },
        ]}
      />
    </div>
  );
}

function DatosTab({ perfil }: { perfil: Perfil }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <DatoCard label="RFC" value={perfil.rfc} />
      <DatoCard label="CURP" value={perfil.curp} />
      <DatoCard label="NSS" value={perfil.nss} />
      <DatoCard label="Email" value={perfil.email} />
      <DatoCard label="Teléfono" value={perfil.telefono} />
      <DatoCard label="Empresa" value={perfil.empresa_nombre} />
    </div>
  );
}

function DatoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{value ?? '—'}</div>
    </div>
  );
}

function ChecadasTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('mis_checadas').select('*').then(({ data }) => setRows(data ?? []));
  }, []);
  if (rows.length === 0) return <EmptyState icon={Clock} title="Sin checadas registradas" />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">Fecha y hora</th>
            <th className="px-4 py-2">Tipo</th>
            <th className="px-4 py-2">Dispositivo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="px-4 py-2 tabular-nums">
                {new Date(c.fecha_hora).toLocaleString('es-MX')}
              </td>
              <td className="px-4 py-2 capitalize">{c.tipo}</td>
              <td className="px-4 py-2 text-slate-600">{c.dispositivo ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AsistenciaTab() {
  const [rows, setRows] = useState<any[]>([]);
  const colors: Record<string, string> = {
    puntual: 'bg-green-100 text-green-700',
    retardo: 'bg-yellow-100 text-yellow-700',
    falta: 'bg-red-100 text-red-700',
    descanso: 'bg-slate-100 text-slate-600',
    pendiente: 'bg-blue-100 text-blue-700',
  };
  useEffect(() => {
    supabase.from('mi_asistencia').select('*').then(({ data }) => setRows(data ?? []));
  }, []);
  if (rows.length === 0) return <EmptyState icon={Calendar} title="Sin registros de asistencia" />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">Fecha</th>
            <th className="px-4 py-2">Entrada</th>
            <th className="px-4 py-2">Salida</th>
            <th className="px-4 py-2 text-right">Retardo</th>
            <th className="px-4 py-2">Estatus</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2">{r.fecha}</td>
              <td className="px-4 py-2 tabular-nums">
                {r.entrada_real ? new Date(r.entrada_real).toLocaleTimeString('es-MX') : '—'}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {r.salida_real ? new Date(r.salida_real).toLocaleTimeString('es-MX') : '—'}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {r.minutos_retardo ? `${r.minutos_retardo} min` : '—'}
              </td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[r.estatus] ?? ''}`}>
                  {r.estatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VacacionesTab() {
  const [saldo, setSaldo] = useState<any | null>(null);
  useEffect(() => {
    supabase.from('mi_vacaciones_saldo').select('*').maybeSingle().then(({ data }) => setSaldo(data));
  }, []);
  if (!saldo) return <EmptyState icon={Palmtree} title="Sin información de vacaciones" />;
  const disponibles = Number(saldo.dias_ganados_total) - Number(saldo.dias_tomados);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Stat label="Días ganados" value={String(saldo.dias_ganados_total)} color="text-slate-700" />
      <Stat label="Días tomados" value={String(saldo.dias_tomados)} color="text-slate-700" />
      <Stat label="Disponibles" value={String(disponibles)} color="text-brand-700" />
      <div className="md:col-span-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Próximo aniversario: <b>{saldo.fecha_proximo_aniversario}</b> ·{' '}
        Días que te tocan: <b>{saldo.dias_proximo_periodo}</b>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function IncidenciasTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const colors: Record<string, string> = {
    registrada: 'bg-slate-100 text-slate-700',
    aprobada: 'bg-green-100 text-green-700',
    rechazada: 'bg-red-100 text-red-700',
    aplicada: 'bg-blue-100 text-blue-700',
  };

  async function load() {
    const { data } = await supabase.from('mis_incidencias').select('*');
    setRows(data ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Nueva solicitud
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={AlertCircle} title="Sin solicitudes" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Desde</th>
                <th className="px-4 py-2">Hasta</th>
                <th className="px-4 py-2 text-right">Días</th>
                <th className="px-4 py-2">Motivo</th>
                <th className="px-4 py-2">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 capitalize">{String(r.tipo).replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2">{r.fecha_inicio}</td>
                  <td className="px-4 py-2">{r.fecha_fin}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(r.dias).toFixed(0)}</td>
                  <td className="px-4 py-2 text-xs text-slate-600 max-w-xs truncate">
                    {r.descripcion ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[r.estatus]}`}>
                      {r.estatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NuevaSolicitudModal open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}

function NuevaSolicitudModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState('vacaciones');
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTipo('vacaciones');
      setDesde(new Date().toISOString().slice(0, 10));
      setHasta(new Date().toISOString().slice(0, 10));
      setDesc('');
      setErr(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc('mi_solicitar_incidencia', {
        p_tipo: tipo,
        p_fecha_inicio: desde,
        p_fecha_fin: hasta,
        p_descripcion: desc || null,
      });
      if (error) throw error;
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva solicitud">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Tipo *"
          options={[
            { value: 'vacaciones', label: 'Vacaciones' },
            { value: 'permiso_con_goce', label: 'Permiso con goce' },
            { value: 'permiso_sin_goce', label: 'Permiso sin goce' },
            { value: 'incapacidad_imss', label: 'Incapacidad IMSS' },
            { value: 'incapacidad_privada', label: 'Incapacidad privada' },
          ]}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Desde *"
            type="date"
            required
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <Input
            label="Hasta *"
            type="date"
            required
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <Input
          label="Motivo / observaciones"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Enviar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecibosTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('mis_recibos').select('*').then(({ data }) => setRows(data ?? []));
  }, []);
  if (rows.length === 0) return <EmptyState icon={DollarSign} title="Sin recibos disponibles" />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">Periodo</th>
            <th className="px-4 py-2">Pago</th>
            <th className="px-4 py-2 text-right">Días</th>
            <th className="px-4 py-2 text-right">Percepciones</th>
            <th className="px-4 py-2 text-right">Deducciones</th>
            <th className="px-4 py-2 text-right">Neto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-2">
                <div className="text-slate-700">{r.fecha_inicio} → {r.fecha_fin}</div>
                <div className="text-xs text-slate-500 capitalize">{r.periodo_tipo}</div>
              </td>
              <td className="px-4 py-2 text-slate-600">{r.fecha_pago ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.dias_trabajados}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.total_percepciones)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt.format(r.total_deducciones)}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums text-brand-700">
                {fmt.format(r.neto_pagar)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('mis_documentos').select('*').then(({ data }) => setRows(data ?? []));
  }, []);
  if (rows.length === 0) return <EmptyState icon={FileText} title="Sin documentos" />;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">Tipo</th>
            <th className="px-4 py-2">Nombre</th>
            <th className="px-4 py-2">Emisión</th>
            <th className="px-4 py-2">Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{d.tipo}</td>
              <td className="px-4 py-2 font-medium">{d.nombre}</td>
              <td className="px-4 py-2 text-slate-600">{d.fecha_emision ?? '—'}</td>
              <td className="px-4 py-2 text-slate-600">{d.fecha_vencimiento ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

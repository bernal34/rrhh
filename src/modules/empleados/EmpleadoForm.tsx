import { FormEvent, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { useCatalogos } from '@/hooks/useCatalogos';
import {
  Empleado,
  getHikMapping,
  syncFotoDesdeHik,
  upsertEmpleado,
} from '@/services/empleadosService';
import {
  GrupoHorario,
  asignarEmpleadoAGrupo,
  getGrupoActualDeEmpleado,
  listGrupos,
} from '@/services/horariosService';
import { supabase } from '@/lib/supabase';
import EmpleadoNotasPanel from './EmpleadoNotasPanel';
import EmpleadoDocsPanel from './EmpleadoDocsPanel';
import EmpleadoSueldosPanel from './EmpleadoSueldosPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  empleado?: Empleado | null;
  onSaved: () => void;
};

const estatusOpts = [
  { value: 'activo', label: 'Activo' },
  { value: 'permiso', label: 'Permiso' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'baja', label: 'Baja' },
];

const generoOpts = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
];

type FormState = Partial<Empleado> & {
  sueldo_diario?: number | string;
  tipo_pago?: 'semanal' | 'quincenal' | 'mensual';
};

const empty: FormState = {
  codigo: '',
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  rfc: '',
  curp: '',
  nss: '',
  fecha_nacimiento: '',
  telefono: '',
  email: '',
  direccion: '',
  sucursal_id: '',
  puesto_id: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  estatus: 'activo',
  foto_url: '',
  sueldo_diario: '',
  tipo_pago: 'quincenal',
};

export default function EmpleadoForm({ open, onClose, empleado, onSaved }: Props) {
  const { sucursales, puestos } = useCatalogos();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hikPersonId, setHikPersonId] = useState<string | null>(null);
  const [syncingFoto, setSyncingFoto] = useState(false);
  const [grupos, setGrupos] = useState<GrupoHorario[]>([]);
  const [grupoActual, setGrupoActual] = useState<string>('');
  const [grupoInicial, setGrupoInicial] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setForm(empleado ? { ...empty, ...empleado } : empty);
    setErr(null);
    setHikPersonId(null);
    setGrupoActual('');
    setGrupoInicial('');
    listGrupos(true).then(setGrupos);

    if (empleado?.id) {
      getHikMapping(empleado.id).then((m) => setHikPersonId(m?.hik_person_id ?? null));
      getGrupoActualDeEmpleado(empleado.id).then((g) => {
        const gid = g?.grupo_id ?? '';
        setGrupoActual(gid);
        setGrupoInicial(gid);
      });
    }
  }, [open, empleado]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSyncFoto() {
    if (!empleado?.id) return;
    setSyncingFoto(true);
    try {
      const res = await syncFotoDesdeHik(empleado.id);
      const r = res.results[0];
      if (r?.ok && r.foto_url) set('foto_url', r.foto_url);
      else setErr(r?.reason ?? 'No se pudo sincronizar la foto');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSyncingFoto(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const { sueldo_diario, tipo_pago, foto_url: _ignored, ...rest } = form;
      void _ignored;
      const payload = { ...rest };
      Object.keys(payload).forEach((k) => {
        const v = payload[k as keyof typeof payload];
        if (v === '') (payload as Record<string, unknown>)[k] = null;
      });

      const saved = await upsertEmpleado(payload);

      if (sueldo_diario && Number(sueldo_diario) > 0) {
        await supabase.from('empleado_sueldo').insert({
          empleado_id: saved.id,
          sueldo_diario: Number(sueldo_diario),
          tipo_pago: tipo_pago ?? 'quincenal',
          vigente_desde: saved.fecha_ingreso ?? new Date().toISOString().slice(0, 10),
        });
      }

      if (grupoActual && grupoActual !== grupoInicial) {
        await asignarEmpleadoAGrupo(saved.id, grupoActual);
      }

      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const enrolado = !!hikPersonId;

  const datosTab = (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-start gap-4 rounded-md bg-slate-50 p-4">
        <Avatar src={form.foto_url ?? undefined} name={form.nombre} size="lg" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-700">Foto facial</div>
          <p className="mt-1 text-xs text-slate-500">
            La foto se captura en el checador (HikCentral Connect). El portal solo la lee.
          </p>
          {empleado?.id && enrolado && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={onSyncFoto}
              loading={syncingFoto}
            >
              <RefreshCw size={14} /> Sincronizar desde HCC
            </Button>
          )}
          {empleado?.id && !enrolado && (
            <p className="mt-2 text-xs text-amber-700">
              Aún no está enrolado en el checador. Enrólalo en el dispositivo para obtener la foto.
            </p>
          )}
        </div>
      </div>

      <Section title="Datos generales">
        <Input label="Código" value={form.codigo ?? ''} onChange={(e) => set('codigo', e.target.value)} />
        <Input label="Nombre *" required value={form.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} />
        <Input label="Apellido paterno" value={form.apellido_paterno ?? ''} onChange={(e) => set('apellido_paterno', e.target.value)} />
        <Input label="Apellido materno" value={form.apellido_materno ?? ''} onChange={(e) => set('apellido_materno', e.target.value)} />
        <Input
          label="RFC"
          maxLength={13}
          value={form.rfc ?? ''}
          onChange={(e) => set('rfc', e.target.value.toUpperCase().replace(/\s/g, ''))}
        />
        <Input
          label="CURP"
          maxLength={18}
          value={form.curp ?? ''}
          onChange={(e) => set('curp', e.target.value.toUpperCase().replace(/\s/g, ''))}
        />
        <Input
          label="NSS (IMSS)"
          inputMode="numeric"
          maxLength={11}
          placeholder="11 dígitos"
          value={form.nss ?? ''}
          onChange={(e) => set('nss', e.target.value.replace(/\D/g, ''))}
          error={form.nss && form.nss.length > 0 && form.nss.length !== 11 ? 'Debe tener 11 dígitos' : undefined}
        />
        <Input label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento ?? ''} onChange={(e) => set('fecha_nacimiento', e.target.value)} />
        <Select label="Género" options={generoOpts} placeholder="—" value={form.genero ?? ''} onChange={(e) => set('genero', e.target.value)} />
      </Section>

      <Section title="Contacto">
        <Input label="Teléfono" value={form.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
        <Input label="Correo" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        <Input label="Dirección" className="md:col-span-2" value={form.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} />
      </Section>

      <Section title="Empleo">
        <Select
          label="Sucursal *"
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          placeholder="Selecciona sucursal"
          required
          value={form.sucursal_id ?? ''}
          onChange={(e) => set('sucursal_id', e.target.value)}
        />
        <Select
          label="Puesto"
          options={puestos.map((p) => ({ value: p.id, label: p.nombre }))}
          placeholder="Selecciona puesto"
          value={form.puesto_id ?? ''}
          onChange={(e) => set('puesto_id', e.target.value)}
        />
        <Input label="Fecha de ingreso *" type="date" required value={form.fecha_ingreso ?? ''} onChange={(e) => set('fecha_ingreso', e.target.value)} />
        <Select label="Estatus" options={estatusOpts} value={form.estatus ?? 'activo'} onChange={(e) => set('estatus', e.target.value as Empleado['estatus'])} />
        <Select
          label="Grupo de horario"
          options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
          placeholder="Sin asignar"
          value={grupoActual}
          onChange={(e) => setGrupoActual(e.target.value)}
          className="md:col-span-2"
        />
      </Section>

      {!empleado && (
        <Section title="Sueldo inicial (opcional)">
          <Input
            label="Sueldo diario"
            type="number"
            step="0.01"
            value={form.sueldo_diario ?? ''}
            onChange={(e) => set('sueldo_diario', e.target.value)}
          />
          <Select
            label="Tipo de pago"
            options={[
              { value: 'semanal', label: 'Semanal' },
              { value: 'quincenal', label: 'Quincenal' },
              { value: 'mensual', label: 'Mensual' },
            ]}
            value={form.tipo_pago ?? 'quincenal'}
            onChange={(e) => set('tipo_pago', e.target.value as FormState['tipo_pago'])}
          />
        </Section>
      )}

      {err && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {empleado ? 'Guardar cambios' : 'Crear empleado'}
        </Button>
      </div>
    </form>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={empleado ? 'Editar empleado' : 'Nuevo empleado'}
      size="xl"
    >
      {empleado?.id ? (
        <Tabs
          tabs={[
            { key: 'datos', label: 'Datos', content: datosTab },
            {
              key: 'sueldo',
              label: 'Sueldo',
              content: <EmpleadoSueldosPanel empleadoId={empleado.id} />,
            },
            {
              key: 'docs',
              label: 'Documentos',
              content: <EmpleadoDocsPanel empleadoId={empleado.id} />,
            },
            {
              key: 'notas',
              label: 'Notas',
              content: <EmpleadoNotasPanel empleadoId={empleado.id} />,
            },
          ]}
        />
      ) : (
        datosTab
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

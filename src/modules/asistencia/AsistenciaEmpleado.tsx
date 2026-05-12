import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Lock, Pencil, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import { Empleado, listEmpleados } from '@/services/empleadosService';
import {
  AsistenciaDiaEditable,
  editarAsistenciaManual,
  listAsistenciaEmpleado,
  recalcularAsistencia,
  verificarPasswordUsuario,
} from '@/services/asistenciaService';

const HERMOSILLO_OFFSET = '-07:00';

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function primerDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// timestamptz (UTC) → "YYYY-MM-DDTHH:MM" en zona Hermosillo, para <input type="datetime-local">
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Hermosillo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// "YYYY-MM-DDTHH:MM" interpretado como hora Hermosillo → ISO UTC
function localInputToIso(local: string): string | null {
  if (!local) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  return new Date(`${local}:00${HERMOSILLO_OFFSET}`).toISOString();
}

function fmtHora(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Hermosillo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function diaSemana(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00${HERMOSILLO_OFFSET}`);
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Hermosillo' }).format(d);
}

function estatusDe(r: AsistenciaDiaEditable): 'descanso' | 'falta' | 'retardo' | 'puntual' | 'pendiente' {
  if (!r.turno_id) return 'descanso';
  if (r.falta) return 'falta';
  if ((r.minutos_retardo ?? 0) > 0) return 'retardo';
  if (r.entrada_real) return 'puntual';
  return 'pendiente';
}

const estatusColor: Record<string, string> = {
  puntual: 'bg-green-100 text-green-700',
  retardo: 'bg-yellow-100 text-yellow-700',
  falta: 'bg-red-100 text-red-700',
  descanso: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-blue-100 text-blue-700',
};

type EditState = {
  row: AsistenciaDiaEditable;
  entrada: string;
  salida: string;
  falta: boolean;
  incidencia: string;
  motivo: string;
};

export default function AsistenciaEmpleado() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('asistencia');

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());
  const [rows, setRows] = useState<AsistenciaDiaEditable[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalc, setRecalc] = useState(false);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [pwd, setPwd] = useState('');
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listEmpleados({ estatus: 'activo' })
      .then((data) => {
        const ordenados = data.sort((a, b) => {
          const an = `${a.apellido_paterno ?? ''} ${a.apellido_materno ?? ''} ${a.nombre}`.trim();
          const bn = `${b.apellido_paterno ?? ''} ${b.apellido_materno ?? ''} ${b.nombre}`.trim();
          return an.localeCompare(bn);
        });
        setEmpleados(ordenados);
      })
      .catch(() => setEmpleados([]));
  }, []);

  async function cargar() {
    if (!empleadoId) return;
    setLoading(true);
    try {
      const data = await listAsistenciaEmpleado(empleadoId, desde, hasta);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  async function onRecalcular() {
    if (!empleadoId) return;
    setRecalc(true);
    try {
      await recalcularAsistencia(desde, hasta, empleadoId);
      await cargar();
    } finally {
      setRecalc(false);
    }
  }

  const empleadoSel = useMemo(
    () => empleados.find((e) => e.id === empleadoId) ?? null,
    [empleados, empleadoId],
  );

  const resumen = useMemo(() => {
    const r: Record<string, number> = {};
    rows.forEach((row) => {
      const e = estatusDe(row);
      r[e] = (r[e] ?? 0) + 1;
    });
    return r;
  }, [rows]);

  function abrirEditor(row: AsistenciaDiaEditable) {
    setPwdError(null);
    setPwd('');
    setEdit({
      row,
      entrada: isoToLocalInput(row.entrada_real),
      salida: isoToLocalInput(row.salida_real),
      falta: row.falta,
      incidencia: row.incidencia ?? '',
      motivo: '',
    });
  }

  function intentarGuardar() {
    if (!edit) return;
    if (!edit.motivo.trim()) {
      alert('El motivo es obligatorio.');
      return;
    }
    setPwdError(null);
    setPwd('');
    setPwdOpen(true);
  }

  async function confirmarConPassword() {
    if (!edit) return;
    setSaving(true);
    setPwdError(null);
    try {
      const ok = await verificarPasswordUsuario(pwd);
      if (!ok) {
        setPwdError('Contraseña incorrecta.');
        setSaving(false);
        return;
      }
      await editarAsistenciaManual({
        id: edit.row.id,
        entrada: localInputToIso(edit.entrada),
        salida: localInputToIso(edit.salida),
        falta: edit.falta,
        incidencia: edit.incidencia.trim() || null,
        motivo: edit.motivo.trim(),
      });
      setPwdOpen(false);
      setEdit(null);
      await cargar();
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/asistencia"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Volver"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-semibold">Asistencia por empleado</h1>
        </div>
        {editar && empleadoId && (
          <Button variant="secondary" onClick={onRecalcular} loading={recalc}>
            <RefreshCw size={16} /> Recalcular
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <Select
            label="Empleado"
            placeholder="Selecciona un empleado…"
            options={empleados.map((e) => ({
              value: e.id,
              label: `${e.codigo ? `${e.codigo} · ` : ''}${[e.apellido_paterno, e.apellido_materno, e.nombre]
                .filter(Boolean)
                .join(' ')}`,
            }))}
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
          />
        </div>
        <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <div className="flex items-end">
          <Button onClick={cargar} loading={loading} disabled={!empleadoId} className="w-full">
            Consultar
          </Button>
        </div>
      </div>

      {empleadoSel && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(resumen).map(([k, v]) => (
            <span
              key={k}
              className={`rounded-full px-3 py-1 text-xs font-medium ${estatusColor[k] ?? ''}`}
            >
              {k}: {v}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Día</th>
              <th className="px-4 py-3">Turno esperado</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Retardo</th>
              <th className="px-4 py-3">Trabajados</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!empleadoId && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Selecciona un empleado para ver su asistencia.
                </td>
              </tr>
            )}
            {empleadoId && loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {empleadoId && !loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Sin datos en el rango. Usa "Recalcular" para procesar las checadas.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const est = estatusDe(r);
              const turno =
                r.hora_entrada_esperada && r.hora_salida_esperada
                  ? `${r.hora_entrada_esperada.slice(0, 5)} – ${r.hora_salida_esperada.slice(0, 5)}`
                  : '—';
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 tabular-nums">{r.fecha}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">{diaSemana(r.fecha)}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{turno}</td>
                  <td className="px-4 py-2 tabular-nums">{fmtHora(r.entrada_real)}</td>
                  <td className="px-4 py-2 tabular-nums">{fmtHora(r.salida_real)}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {r.minutos_retardo ? `${r.minutos_retardo} min` : '—'}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {r.minutos_trabajados != null
                      ? `${Math.floor(r.minutos_trabajados / 60)}h ${r.minutos_trabajados % 60}m`
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${estatusColor[est] ?? ''}`}
                      >
                        {est}
                      </span>
                      {r.editado_manual && (
                        <span
                          className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700"
                          title={r.editado_motivo ?? ''}
                        >
                          editado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.bloqueado ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Lock size={12} /> bloqueado
                      </span>
                    ) : editar ? (
                      <Button variant="secondary" size="sm" onClick={() => abrirEditor(r)}>
                        <Pencil size={14} /> Editar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Editar asistencia · ${edit.row.fecha}` : ''}
        size="md"
      >
        {edit && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Los cambios manuales no se sobrescriben al recalcular. Se registran en bitácora con motivo y autor.
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Entrada real"
                type="datetime-local"
                value={edit.entrada}
                onChange={(e) => setEdit({ ...edit, entrada: e.target.value })}
              />
              <Input
                label="Salida real"
                type="datetime-local"
                value={edit.salida}
                onChange={(e) => setEdit({ ...edit, salida: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.falta}
                onChange={(e) => setEdit({ ...edit, falta: e.target.checked })}
              />
              Marcar como falta
            </label>
            <Input
              label="Incidencia (opcional)"
              value={edit.incidencia}
              onChange={(e) => setEdit({ ...edit, incidencia: e.target.value })}
              placeholder="permiso, incapacidad, etc."
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Motivo del cambio *</label>
              <textarea
                className="min-h-[80px] rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={edit.motivo}
                onChange={(e) => setEdit({ ...edit, motivo: e.target.value })}
                placeholder="Ej. olvidó checar entrada, corrigiendo por incidencia aprobada, etc."
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button onClick={intentarGuardar}>
                <ShieldCheck size={16} /> Continuar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={pwdOpen}
        onClose={() => (saving ? undefined : setPwdOpen(false))}
        title="Confirma con tu contraseña"
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <div className="text-sm text-slate-600">
            Para autorizar esta modificación manual de asistencia, ingresa tu contraseña actual.
          </div>
          <Input
            label="Contraseña"
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pwd && !saving) void confirmarConPassword();
            }}
            error={pwdError ?? undefined}
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="secondary" onClick={() => setPwdOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirmarConPassword} loading={saving} disabled={!pwd}>
              Autorizar y guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

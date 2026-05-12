import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Empleado, listEmpleados } from '@/services/empleadosService';
import { AsistenciaRow, getAsistencia } from '@/services/asistenciaService';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const estatusColor: Record<string, string> = {
  puntual: 'bg-green-100 text-green-800 border-green-200',
  retardo: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  falta: 'bg-red-100 text-red-800 border-red-200',
  descanso: 'bg-slate-100 text-slate-500 border-slate-200',
  pendiente: 'bg-blue-100 text-blue-800 border-blue-200',
};

function ultimoDiaMes(year: number, monthIdx0: number) {
  return new Date(year, monthIdx0 + 1, 0).getDate();
}

export default function CalendarioMensual() {
  const now = new Date();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [rows, setRows] = useState<AsistenciaRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listEmpleados({ estatus: 'activo' })
      .then((data) => {
        const ordenados = data.sort((a, b) =>
          `${a.apellido_paterno ?? ''} ${a.nombre}`.localeCompare(
            `${b.apellido_paterno ?? ''} ${b.nombre}`,
          ),
        );
        setEmpleados(ordenados);
      })
      .catch(() => setEmpleados([]));
  }, []);

  async function consultar() {
    if (!empleadoId) return;
    setLoading(true);
    try {
      const y = Number(anio);
      const m = Number(mes);
      const desde = `${anio}-${mes}-01`;
      const hasta = `${anio}-${mes}-${String(ultimoDiaMes(y, m - 1)).padStart(2, '0')}`;
      const data = await getAsistencia({ desde, hasta, empleadoId });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  const empleadoSel = useMemo(
    () => empleados.find((e) => e.id === empleadoId) ?? null,
    [empleados, empleadoId],
  );

  const dataPorDia = useMemo(() => {
    const m = new Map<string, AsistenciaRow>();
    rows.forEach((r) => m.set(r.fecha, r));
    return m;
  }, [rows]);

  const grid = useMemo(() => {
    const y = Number(anio);
    const m = Number(mes);
    const dias = ultimoDiaMes(y, m - 1);
    const primerDow = new Date(y, m - 1, 1).getDay();
    const cells: Array<{ dia: number | null; row: AsistenciaRow | null }> = [];
    for (let i = 0; i < primerDow; i++) cells.push({ dia: null, row: null });
    for (let d = 1; d <= dias; d++) {
      const fecha = `${anio}-${mes}-${String(d).padStart(2, '0')}`;
      cells.push({ dia: d, row: dataPorDia.get(fecha) ?? null });
    }
    while (cells.length % 7 !== 0) cells.push({ dia: null, row: null });
    return cells;
  }, [anio, mes, dataPorDia]);

  const resumen = useMemo(() => {
    const r: Record<string, number> = {};
    rows.forEach((row) => {
      r[row.estatus] = (r[row.estatus] ?? 0) + 1;
    });
    return r;
  }, [rows]);

  function imprimir() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5 print:hidden">
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
        <Select
          label="Año"
          options={[anio, String(now.getFullYear() - 1), String(now.getFullYear())].map((y) => ({
            value: y,
            label: y,
          }))}
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
        />
        <Select
          label="Mes"
          options={[
            ['01', 'Enero'],
            ['02', 'Febrero'],
            ['03', 'Marzo'],
            ['04', 'Abril'],
            ['05', 'Mayo'],
            ['06', 'Junio'],
            ['07', 'Julio'],
            ['08', 'Agosto'],
            ['09', 'Septiembre'],
            ['10', 'Octubre'],
            ['11', 'Noviembre'],
            ['12', 'Diciembre'],
          ].map(([v, l]) => ({ value: v, label: l }))}
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        />
        <div className="flex items-end gap-2">
          <Button onClick={consultar} loading={loading} disabled={!empleadoId} className="flex-1">
            Consultar
          </Button>
          <Button variant="secondary" onClick={imprimir} disabled={rows.length === 0}>
            <Printer size={14} />
          </Button>
        </div>
      </div>

      {empleadoSel && rows.length > 0 && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Empleado</div>
              <div className="text-lg font-semibold">
                {[empleadoSel.apellido_paterno, empleadoSel.apellido_materno, empleadoSel.nombre]
                  .filter(Boolean)
                  .join(' ')}
              </div>
              <div className="text-xs text-slate-500">
                {empleadoSel.codigo ?? '—'} · {anio}-{mes}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(resumen).map(([k, v]) => (
                <span
                  key={k}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${estatusColor[k] ?? ''}`}
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((c, i) => (
                <div
                  key={i}
                  className={`min-h-[88px] border-b border-r border-slate-100 p-2 text-xs ${
                    c.row ? estatusColor[c.row.estatus] ?? '' : ''
                  } ${c.dia == null ? 'bg-slate-50/50' : ''}`}
                >
                  {c.dia != null && (
                    <>
                      <div className="mb-1 font-semibold tabular-nums">{c.dia}</div>
                      {c.row && (
                        <div className="flex flex-col gap-0.5 leading-tight">
                          <div className="text-[10px] uppercase tracking-wider opacity-80">
                            {c.row.estatus}
                          </div>
                          {c.row.entrada_real && (
                            <div className="tabular-nums">
                              ↓{' '}
                              {new Intl.DateTimeFormat('es-MX', {
                                timeZone: 'America/Hermosillo',
                                hour: '2-digit',
                                minute: '2-digit',
                                hourCycle: 'h23',
                              }).format(new Date(c.row.entrada_real))}
                            </div>
                          )}
                          {c.row.salida_real && (
                            <div className="tabular-nums">
                              ↑{' '}
                              {new Intl.DateTimeFormat('es-MX', {
                                timeZone: 'America/Hermosillo',
                                hour: '2-digit',
                                minute: '2-digit',
                                hourCycle: 'h23',
                              }).format(new Date(c.row.salida_real))}
                            </div>
                          )}
                          {(c.row.minutos_retardo ?? 0) > 0 && (
                            <div className="font-medium">+{c.row.minutos_retardo} min</div>
                          )}
                          {c.row.incidencia && (
                            <div className="italic opacity-80">{c.row.incidencia}</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!empleadoId && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Selecciona un empleado, mes y año para ver su calendario.
        </div>
      )}
    </div>
  );
}

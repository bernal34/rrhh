import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Cake, Award, Palmtree, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

type Evento = {
  fecha: string; // YYYY-MM-DD
  tipo: 'cumpleanos' | 'aniversario' | 'vacaciones' | 'incidencia';
  nombre: string;
  detalle?: string;
};

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CalendarioPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  const anio = cursor.getFullYear();
  const mes = cursor.getMonth(); // 0..11
  const desde = new Date(anio, mes, 1).toISOString().slice(0, 10);
  const hasta = new Date(anio, mes + 1, 0).toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from('empleados')
        .select('nombre, apellido_paterno, fecha_nacimiento, fecha_ingreso')
        .eq('estatus', 'activo'),
      supabase
        .from('incidencias')
        .select('tipo, fecha_inicio, fecha_fin, descripcion, empleado:empleados(nombre, apellido_paterno)')
        .in('estatus', ['aprobada', 'aplicada'])
        .or(`fecha_inicio.lte.${hasta},fecha_fin.gte.${desde}`),
    ]).then(([empsRes, incRes]) => {
      const evs: Evento[] = [];

      // Cumpleaños y aniversarios del mes
      (empsRes.data ?? []).forEach((e: any) => {
        const nombre = `${e.nombre} ${e.apellido_paterno ?? ''}`.trim();
        if (e.fecha_nacimiento) {
          const fn = new Date(e.fecha_nacimiento + 'T00:00:00');
          if (fn.getMonth() === mes) {
            evs.push({
              fecha: `${anio}-${String(mes + 1).padStart(2, '0')}-${String(fn.getDate()).padStart(2, '0')}`,
              tipo: 'cumpleanos',
              nombre,
            });
          }
        }
        if (e.fecha_ingreso) {
          const fi = new Date(e.fecha_ingreso + 'T00:00:00');
          const anios = anio - fi.getFullYear();
          if (fi.getMonth() === mes && anios >= 1) {
            evs.push({
              fecha: `${anio}-${String(mes + 1).padStart(2, '0')}-${String(fi.getDate()).padStart(2, '0')}`,
              tipo: 'aniversario',
              nombre,
              detalle: `${anios} ${anios === 1 ? 'año' : 'años'}`,
            });
          }
        }
      });

      // Incidencias / vacaciones (expand range to days within month)
      (incRes.data ?? []).forEach((i: any) => {
        const ini = new Date(i.fecha_inicio + 'T00:00:00');
        const fin = new Date(i.fecha_fin + 'T00:00:00');
        const start = new Date(Math.max(ini.getTime(), new Date(anio, mes, 1).getTime()));
        const end = new Date(Math.min(fin.getTime(), new Date(anio, mes + 1, 0).getTime()));
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const fechaStr = d.toISOString().slice(0, 10);
          const nombre = i.empleado
            ? `${i.empleado.nombre} ${i.empleado.apellido_paterno ?? ''}`.trim()
            : '—';
          evs.push({
            fecha: fechaStr,
            tipo: i.tipo === 'vacaciones' ? 'vacaciones' : 'incidencia',
            nombre,
            detalle: i.tipo,
          });
        }
      });

      setEventos(evs);
      setLoading(false);
    });
  }, [anio, mes, desde, hasta]);

  const eventosByDay = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    eventos.forEach((e) => {
      if (!m[e.fecha]) m[e.fecha] = [];
      m[e.fecha].push(e);
    });
    return m;
  }, [eventos]);

  // Construir cuadrícula del mes (incluye días "padding" del mes anterior/siguiente)
  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: Array<{ dia: number | null; fecha: string | null }> = [];
  for (let i = 0; i < primerDiaSemana; i++) celdas.push({ dia: null, fecha: null });
  for (let d = 1; d <= diasMes; d++) {
    celdas.push({
      dia: d,
      fecha: `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }
  while (celdas.length % 7 !== 0) celdas.push({ dia: null, fecha: null });

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(anio, mes - 1, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[180px] text-center text-sm font-medium capitalize">
            {cursor.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(anio, mes + 1, 1))}>
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Hoy
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <Leyenda icon={<Cake size={12} />} color="bg-pink-100 text-pink-700" label="Cumpleaños" />
        <Leyenda icon={<Award size={12} />} color="bg-purple-100 text-purple-700" label="Aniversario" />
        <Leyenda icon={<Palmtree size={12} />} color="bg-green-100 text-green-700" label="Vacaciones" />
        <Leyenda icon={<AlertCircle size={12} />} color="bg-blue-100 text-blue-700" label="Incidencia" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-600">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {loading ? (
            <div className="col-span-7 py-12 text-center text-slate-500">Cargando…</div>
          ) : (
            celdas.map((c, idx) => (
              <div
                key={idx}
                className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 text-xs ${
                  c.fecha === hoy ? 'bg-brand-50' : c.dia ? '' : 'bg-slate-50'
                }`}
              >
                {c.dia && (
                  <div
                    className={`mb-1 text-right text-xs font-medium ${
                      c.fecha === hoy ? 'text-brand-700' : 'text-slate-700'
                    }`}
                  >
                    {c.dia}
                  </div>
                )}
                {c.fecha &&
                  (eventosByDay[c.fecha] ?? []).slice(0, 3).map((e, i) => (
                    <div
                      key={i}
                      className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] ${tagColor(e.tipo)}`}
                      title={`${e.nombre}${e.detalle ? ` - ${e.detalle}` : ''}`}
                    >
                      {e.nombre}
                    </div>
                  ))}
                {c.fecha && (eventosByDay[c.fecha]?.length ?? 0) > 3 && (
                  <div className="text-[10px] text-slate-500">
                    +{(eventosByDay[c.fecha]?.length ?? 0) - 3} más
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function tagColor(tipo: Evento['tipo']) {
  switch (tipo) {
    case 'cumpleanos':
      return 'bg-pink-100 text-pink-800';
    case 'aniversario':
      return 'bg-purple-100 text-purple-800';
    case 'vacaciones':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
}

function Leyenda({ icon, color, label }: { icon: React.ReactNode; color: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${color}`}>
      {icon} {label}
    </span>
  );
}

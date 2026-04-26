import { supabase } from '@/lib/supabase';

export type DashboardData = {
  empleadosActivos: number;
  asistenciaHoy: { puntual: number; retardo: number; falta: number; pendiente: number };
  cumpleanos: Array<{ id: string; nombre: string; fecha_nacimiento: string; dia: number }>;
  aniversarios: Array<{
    id: string;
    nombre: string;
    fecha_ingreso: string;
    dia: number;
    anios: number;
  }>;
  docsPorVencer: Array<{
    id: string;
    nombre: string;
    tipo: string;
    fecha_vencimiento: string;
    empleado_nombre: string;
    dias_restantes: number;
  }>;
  vacacionesAlertas: Array<{
    empleado_id: string;
    nombre: string;
    dias_disponibles: number;
  }>;
};

function nombreCompleto(e: {
  nombre: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
}) {
  return [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ');
}

export async function loadDashboard(): Promise<DashboardData> {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1; // 1..12
  const fechaHoy = hoy.toISOString().slice(0, 10);
  const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Empleados activos
  const { count: activos } = await supabase
    .from('empleados')
    .select('id', { count: 'exact', head: true })
    .eq('estatus', 'activo');

  // Asistencia de hoy (usa la vista que computa el estatus)
  const { data: asis } = await supabase
    .from('v_reporte_asistencia')
    .select('estatus')
    .eq('fecha', fechaHoy);
  const asistenciaHoy = { puntual: 0, retardo: 0, falta: 0, pendiente: 0 };
  (asis ?? []).forEach((r: { estatus: string }) => {
    if (r.estatus in asistenciaHoy) {
      asistenciaHoy[r.estatus as keyof typeof asistenciaHoy]++;
    }
  });

  // Cumpleaños y aniversarios del mes (filtramos en JS porque PostgREST no expone EXTRACT fácilmente)
  const { data: empleadosTodos } = await supabase
    .from('empleados')
    .select('id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_ingreso')
    .eq('estatus', 'activo');

  const cumpleanos = (empleadosTodos ?? [])
    .filter(
      (e: { fecha_nacimiento: string | null }) =>
        e.fecha_nacimiento && new Date(e.fecha_nacimiento + 'T00:00:00').getMonth() + 1 === mes,
    )
    .map((e) => ({
      id: e.id,
      nombre: nombreCompleto(e),
      fecha_nacimiento: e.fecha_nacimiento as string,
      dia: new Date((e.fecha_nacimiento as string) + 'T00:00:00').getDate(),
    }))
    .sort((a, b) => a.dia - b.dia);

  const aniversarios = (empleadosTodos ?? [])
    .filter(
      (e: { fecha_ingreso: string }) =>
        e.fecha_ingreso && new Date(e.fecha_ingreso + 'T00:00:00').getMonth() + 1 === mes,
    )
    .map((e) => {
      const ing = new Date((e.fecha_ingreso as string) + 'T00:00:00');
      const anios = hoy.getFullYear() - ing.getFullYear();
      return {
        id: e.id,
        nombre: nombreCompleto(e),
        fecha_ingreso: e.fecha_ingreso as string,
        dia: ing.getDate(),
        anios,
      };
    })
    .filter((a) => a.anios >= 1)
    .sort((a, b) => a.dia - b.dia);

  // Docs por vencer (≤ 30 días)
  const { data: docs } = await supabase
    .from('documentos')
    .select('id, nombre, tipo, fecha_vencimiento, empleado:empleados(nombre, apellido_paterno)')
    .gte('fecha_vencimiento', fechaHoy)
    .lte('fecha_vencimiento', en30)
    .order('fecha_vencimiento', { ascending: true })
    .limit(10);

  const docsPorVencer = (docs ?? []).map((d: any) => {
    const dias = Math.ceil(
      (new Date(d.fecha_vencimiento + 'T00:00:00').getTime() - hoy.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return {
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      fecha_vencimiento: d.fecha_vencimiento,
      empleado_nombre: d.empleado
        ? `${d.empleado.nombre} ${d.empleado.apellido_paterno ?? ''}`.trim()
        : '—',
      dias_restantes: dias,
    };
  });

  // Vacaciones acumuladas: top 5 con más días disponibles
  const { data: saldos } = await supabase
    .from('vacaciones_saldos')
    .select('empleado_id, nombre, apellido_paterno, dias_ganados_total, dias_tomados');
  const vacacionesAlertas = (saldos ?? [])
    .map((s: any) => ({
      empleado_id: s.empleado_id,
      nombre: `${s.nombre} ${s.apellido_paterno ?? ''}`.trim(),
      dias_disponibles: Number(s.dias_ganados_total) - Number(s.dias_tomados),
    }))
    .filter((s) => s.dias_disponibles >= 15)
    .sort((a, b) => b.dias_disponibles - a.dias_disponibles)
    .slice(0, 5);

  return {
    empleadosActivos: activos ?? 0,
    asistenciaHoy,
    cumpleanos,
    aniversarios,
    docsPorVencer,
    vacacionesAlertas,
  };
}

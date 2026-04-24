// Genera una constancia laboral en HTML imprimible (Guardar como PDF).
import { supabase } from './supabase';

type Empleado = {
  id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  fecha_ingreso: string;
  estatus: string;
  puesto: { nombre: string } | null;
  sucursal: { nombre: string; direccion: string | null } | null;
};

type SueldoRow = { sueldo_mensual: number };

const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function diferenciaAnios(desde: string): { anios: number; meses: number } {
  const ini = new Date(desde + 'T00:00:00');
  const hoy = new Date();
  let anios = hoy.getFullYear() - ini.getFullYear();
  let meses = hoy.getMonth() - ini.getMonth();
  if (meses < 0) {
    anios--;
    meses += 12;
  }
  if (hoy.getDate() < ini.getDate()) meses--;
  if (meses < 0) {
    meses += 12;
    anios--;
  }
  return { anios, meses };
}

export async function abrirConstanciaLaboral(empleadoId: string, opts: { incluirSueldo?: boolean } = {}) {
  const { data: emp, error } = await supabase
    .from('empleados')
    .select(
      `id, nombre, apellido_paterno, apellido_materno, rfc, curp, nss, fecha_ingreso, estatus,
       puesto:puestos(nombre),
       sucursal:sucursales(nombre, direccion)`,
    )
    .eq('id', empleadoId)
    .single();
  if (error) throw error;

  let sueldo: number | null = null;
  if (opts.incluirSueldo) {
    const { data: s } = await supabase
      .from('empleado_sueldo')
      .select('sueldo_mensual')
      .eq('empleado_id', empleadoId)
      .order('vigente_desde', { ascending: false })
      .limit(1)
      .maybeSingle<SueldoRow>();
    sueldo = s?.sueldo_mensual ?? null;
  }

  const e = emp as unknown as Empleado;
  const nombre = [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ');
  const { anios, meses } = diferenciaAnios(e.fecha_ingreso);
  const html = htmlConstancia({ e, nombre, anios, meses, sueldo });
  const w = window.open('', '_blank');
  if (!w) {
    alert('Permite ventanas emergentes para generar la constancia.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

function htmlConstancia(args: {
  e: Empleado;
  nombre: string;
  anios: number;
  meses: number;
  sueldo: number | null;
}): string {
  const { e, nombre, anios, meses, sueldo } = args;
  const fechaActual = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const antiguedadTexto =
    anios > 0
      ? `${anios} ${anios === 1 ? 'año' : 'años'}${meses > 0 ? ` y ${meses} ${meses === 1 ? 'mes' : 'meses'}` : ''}`
      : `${meses} ${meses === 1 ? 'mes' : 'meses'}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Constancia laboral - ${nombre}</title>
<style>
  body{font-family:'Times New Roman',serif;color:#1a1a1a;padding:50px 60px;max-width:780px;margin:auto;font-size:13px;line-height:1.7}
  h1{font-size:18px;margin:30px 0 4px;text-transform:uppercase;text-align:center;letter-spacing:2px}
  h2{font-size:13px;text-align:center;color:#555;margin:0 0 40px;font-weight:normal}
  .header{text-align:right;color:#555;font-size:11px;margin-bottom:30px}
  .body{text-align:justify;margin:30px 0}
  .body p{margin:14px 0}
  .firma{margin-top:80px;text-align:center;border-top:1px solid #1a1a1a;width:300px;margin-left:auto;margin-right:auto;padding-top:6px}
  .negro{font-weight:bold}
  @media print { body{padding:30px 50px} .no-print{display:none} }
</style></head><body>

<div class="header">
  ${e.sucursal?.nombre ?? ''}<br/>
  ${e.sucursal?.direccion ?? ''}<br/>
  ${fechaActual}
</div>

<h1>Constancia laboral</h1>
<h2>A QUIEN CORRESPONDA</h2>

<div class="body">
  <p>
    Por medio de la presente se hace constar que el(la) C.
    <span class="negro">${nombre}</span>
    ${e.rfc ? `con RFC <span class="negro">${e.rfc}</span>` : ''}
    ${e.curp ? `, CURP <span class="negro">${e.curp}</span>` : ''}
    ${e.nss ? `y NSS <span class="negro">${e.nss}</span>` : ''}, labora para esta empresa
    desde el <span class="negro">${fmtFecha(e.fecha_ingreso)}</span>, con una antigüedad de
    <span class="negro">${antiguedadTexto}</span>, desempeñando el puesto de
    <span class="negro">${e.puesto?.nombre ?? '—'}</span>${e.sucursal ? ` en ${e.sucursal.nombre}` : ''}.
  </p>

  ${
    sueldo != null
      ? `<p>Su salario mensual bruto actual es de <span class="negro">${fmtMXN.format(sueldo)} (${sueldo.toFixed(2)} pesos M.N.)</span>.</p>`
      : ''
  }

  <p>
    Se extiende la presente a petición del interesado, para los fines legales que a su
    derecho convengan, en la ciudad correspondiente, el día ${fechaActual}.
  </p>
</div>

<div class="firma">
  <div>Recursos Humanos</div>
  <div style="font-size:11px;color:#555;margin-top:4px">Firma y sello</div>
</div>

<div class="no-print" style="text-align:center;margin-top:40px">
  <button onclick="window.print()" style="padding:10px 24px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">
    Imprimir / Guardar como PDF
  </button>
</div>

<script>setTimeout(()=>window.print(),300)</script>
</body></html>`;
}

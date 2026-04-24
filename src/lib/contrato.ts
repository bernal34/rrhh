// Contrato individual de trabajo por tiempo indeterminado.
// Listo para imprimir y firmar (Art. 25 LFT).

import { supabase } from './supabase';

const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export async function abrirContrato(empleadoId: string) {
  const { data: emp, error } = await supabase
    .from('empleados')
    .select(
      `id, nombre, apellido_paterno, apellido_materno, rfc, curp, nss, fecha_nacimiento,
       fecha_ingreso, telefono, email, direccion, empresa_id,
       puesto:puestos(nombre, descripcion),
       sucursal:sucursales(nombre, direccion)`,
    )
    .eq('id', empleadoId)
    .single();
  if (error) throw error;
  const e = emp as any;

  let empresa: any = null;
  if (e.empresa_id) {
    const { data } = await supabase.from('empresas').select('*').eq('id', e.empresa_id).single();
    empresa = data;
  }

  const { data: sueldo } = await supabase
    .from('empleado_sueldo')
    .select('sueldo_diario, sueldo_mensual, tipo_pago')
    .eq('empleado_id', empleadoId)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nombre = [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ');
  const ciudad = empresa?.ciudad ?? '_____________';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Contrato · ${nombre}</title>
<style>
  @page { size: letter; margin: 18mm 20mm; }
  body{font-family:'Times New Roman',serif;color:#000;font-size:12px;line-height:1.65;margin:0}
  h1{text-align:center;font-size:16px;margin:0 0 4px;letter-spacing:1px}
  h2{text-align:center;font-size:11px;font-weight:normal;color:#444;margin:0 0 24px}
  h3{font-size:12px;background:#e5e5e5;padding:4px 6px;margin:18px 0 10px;border-left:3px solid #000}
  p{text-align:justify;margin:8px 0}
  .negro{font-weight:bold}
  .header{text-align:right;font-size:11px;color:#444;margin-bottom:14px}
  .firma{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
  .firma .box{text-align:center;border-top:1px solid #000;padding-top:6px;font-size:11px}
  ol li{margin:5px 0}
  table.datos{width:100%;border-collapse:collapse;margin:8px 0}
  table.datos td{border:1px solid #aaa;padding:5px 8px;font-size:11px}
  table.datos td.k{background:#f0f0f0;font-weight:bold;width:38%}
  @media print { .no-print{display:none} }
</style></head><body>

<div class="header">
  ${empresa?.razon_social ?? '<span style="color:#a00">[ASIGNA UNA EMPRESA AL EMPLEADO]</span>'}<br/>
  ${empresa?.rfc ? `RFC: ${empresa.rfc}<br/>` : ''}
  ${empresa?.registro_patronal_imss ? `Reg. Patronal IMSS: ${empresa.registro_patronal_imss}<br/>` : ''}
  ${ciudad}, ${fmtFecha(e.fecha_ingreso)}
</div>

<h1>CONTRATO INDIVIDUAL DE TRABAJO</h1>
<h2>Por tiempo indeterminado · Conforme a la Ley Federal del Trabajo (Art. 25)</h2>

<p>
  En la ciudad de <span class="negro">${ciudad}</span>, a los <span class="negro">${fmtFecha(e.fecha_ingreso)}</span>,
  comparecen por una parte <span class="negro">${empresa?.razon_social ?? '_____________'}</span>${empresa?.rfc ? `, con RFC <span class="negro">${empresa.rfc}</span>` : ''}, con domicilio fiscal en
  <span class="negro">${empresa?.domicilio_fiscal ?? '_____________'}</span>, representada por
  <span class="negro">${empresa?.representante_legal ?? '_____________'}</span> en su carácter de
  <span class="negro">${empresa?.representante_puesto ?? 'Representante Legal'}</span>, a quien en lo
  sucesivo se le denominará "<b>EL PATRÓN</b>"; y por la otra parte el(la) C.
  <span class="negro">${nombre}</span>, mexicano(a), con RFC
  <span class="negro">${e.rfc ?? '_____________'}</span>, CURP
  <span class="negro">${e.curp ?? '_____________'}</span>${e.nss ? `, NSS <span class="negro">${e.nss}</span>` : ''},
  ${e.fecha_nacimiento ? `nacido(a) el <span class="negro">${fmtFecha(e.fecha_nacimiento)}</span>, ` : ''}
  con domicilio en <span class="negro">${e.direccion ?? '_____________'}</span>, a quien en lo sucesivo
  se le denominará "<b>EL TRABAJADOR</b>", quienes manifiestan tener celebrado el presente
  <b>contrato individual de trabajo por tiempo indeterminado</b> al tenor de las siguientes:
</p>

<h3>D E C L A R A C I O N E S</h3>

<p>
  <b>I.</b> "EL PATRÓN" declara ser una persona jurídica legalmente constituida conforme a las leyes
  mexicanas, con personalidad y capacidad para obligarse en los términos del presente contrato.
</p>

<p>
  <b>II.</b> "EL TRABAJADOR" declara estar capacitado y reunir los conocimientos y la experiencia
  necesarios para desempeñar el puesto materia del presente contrato.
</p>

<h3>C L Á U S U L A S</h3>

<p>
  <b>PRIMERA.- Objeto.</b> "EL PATRÓN" contrata los servicios personales y subordinados de
  "EL TRABAJADOR", quien se obliga a desempeñar el puesto de <span class="negro">${e.puesto?.nombre ?? '_____________'}</span>${e.puesto?.descripcion ? `, cuyas funciones principales son: ${e.puesto.descripcion}` : ''}.
</p>

<p>
  <b>SEGUNDA.- Lugar de trabajo.</b> Los servicios se prestarán en
  <span class="negro">${e.sucursal?.nombre ?? '_____________'}${e.sucursal?.direccion ? `, ubicado en ${e.sucursal.direccion}` : ''}</span>,
  pudiendo "EL PATRÓN" cambiar el lugar de prestación de servicios cuando las necesidades del servicio
  así lo requieran, dentro del mismo municipio.
</p>

<p>
  <b>TERCERA.- Duración.</b> El presente contrato se celebra por <b>tiempo indeterminado</b>,
  iniciando la relación laboral el día <span class="negro">${fmtFecha(e.fecha_ingreso)}</span>.
  Las partes acuerdan un periodo de prueba de <b>30 días</b> conforme al artículo 39-A de la LFT.
</p>

<p>
  <b>CUARTA.- Jornada.</b> "EL TRABAJADOR" se obliga a prestar sus servicios durante la jornada
  semanal acordada, respetando los horarios y descansos que le sean asignados, sin exceder los
  máximos legales establecidos por los artículos 60 a 64 de la LFT.
</p>

<p>
  <b>QUINTA.- Salario.</b> "EL PATRÓN" pagará a "EL TRABAJADOR" un salario
  ${sueldo ? `de <span class="negro">${fmtMXN.format(sueldo.sueldo_diario)}</span> diarios, equivalente a <span class="negro">${fmtMXN.format(sueldo.sueldo_mensual)}</span> mensuales,` : 'de <span class="negro">_____________ pesos M.N.</span> diarios,'}
  pagaderos de manera ${sueldo?.tipo_pago ?? '_____________'} en moneda nacional, mediante depósito
  bancario o el medio que se acuerde por escrito, conforme a los artículos 82 a 89 de la LFT.
</p>

<p>
  <b>SEXTA.- Prestaciones.</b> "EL TRABAJADOR" gozará de las prestaciones mínimas establecidas en
  la LFT, incluyendo: aguinaldo (Art. 87), vacaciones según tabla del Art. 76 reformada en 2023,
  prima vacacional del 25% (Art. 80), día de descanso semanal (Art. 69), descansos obligatorios
  (Art. 74), participación de utilidades (Art. 117) y seguridad social (IMSS / INFONAVIT).
</p>

<p>
  <b>SÉPTIMA.- Capacitación.</b> "EL TRABAJADOR" se compromete a recibir la capacitación y
  adiestramiento que "EL PATRÓN" le proporcione, conforme al Capítulo III Bis de la LFT.
</p>

<p>
  <b>OCTAVA.- Confidencialidad.</b> "EL TRABAJADOR" se obliga a guardar absoluta reserva sobre los
  asuntos, información, datos y documentos de los que tenga conocimiento con motivo de la prestación
  de sus servicios, aún después de terminada la relación laboral.
</p>

<p>
  <b>NOVENA.- Reglamento interior.</b> "EL TRABAJADOR" manifiesta haber recibido y conocer el
  Reglamento Interior de Trabajo y demás políticas de "EL PATRÓN", obligándose a su debida
  observancia y cumplimiento.
</p>

<p>
  <b>DÉCIMA.- Causales de rescisión.</b> Será causa de rescisión sin responsabilidad para
  "EL PATRÓN" cualquiera de las contempladas en el artículo 47 de la LFT.
</p>

<p>
  <b>DÉCIMA PRIMERA.- Jurisdicción.</b> Para la interpretación y cumplimiento del presente contrato,
  las partes se someten expresamente a la competencia de los Tribunales del Trabajo en la circunscripción
  territorial de <span class="negro">${empresa?.ciudad ?? '_____________'}</span>, renunciando a cualquier otro fuero que pudiera
  corresponderles por razón de su domicilio presente o futuro.
</p>

<p style="margin-top:24px">
  Leído el presente contrato y enteradas las partes de su contenido, alcance y efectos legales,
  lo firman por duplicado quedando un ejemplar en poder de cada una.
</p>

<div class="firma">
  <div class="box">
    ${nombre}<br/>
    "EL TRABAJADOR"
  </div>
  <div class="box">
    ${empresa?.representante_legal ?? '_____________'}<br/>
    ${empresa?.representante_puesto ?? 'Representante Legal'}<br/>
    "EL PATRÓN"
  </div>
</div>

<div class="no-print" style="text-align:center;margin-top:30px">
  <button onclick="window.print()" style="padding:10px 24px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">
    Imprimir / Guardar PDF
  </button>
</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Permite ventanas emergentes para generar el contrato.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

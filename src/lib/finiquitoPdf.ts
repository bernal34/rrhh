// Convenio de terminación / finiquito - documento legal listo para firma.
import { supabase } from './supabase';

export type FiniquitoConceptos = {
  causa: 'renuncia' | 'despido_justificado' | 'despido_injustificado' | 'mutuo_acuerdo';
  fechaBaja: string;
  sueldoMensual: number;
  salarioDiario: number;
  salarioDiarioIntegrado: number;
  diasAntiguedad: number;
  aniosAntiguedad: number;
  // Conceptos
  aguinaldoProp: number;
  vacacionesProp: number;
  primaVacacional: number;
  sueldoPendiente: number;
  vacPendientesMonto: number;
  indemn3meses: number;
  prima20: number;
  primaAntiguedad: number;
  totalFiniquito: number;
  totalLiquidacion: number;
  granTotal: number;
};

const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function numeroALetras(n: number): string {
  const enteros = Math.floor(n);
  const cents = Math.round((n - enteros) * 100);
  return `(${enteros.toLocaleString('es-MX')} pesos ${String(cents).padStart(2, '0')}/100 M.N.)`;
}

const causaTexto: Record<FiniquitoConceptos['causa'], string> = {
  renuncia: 'renuncia voluntaria del trabajador, conforme al artículo 53 fracción I de la Ley Federal del Trabajo',
  despido_justificado:
    'rescisión de la relación laboral por causa imputable al trabajador, conforme al artículo 47 de la Ley Federal del Trabajo',
  despido_injustificado:
    'terminación de la relación laboral sin causa justificada, en términos del artículo 48 y 50 de la Ley Federal del Trabajo',
  mutuo_acuerdo:
    'terminación por mutuo consentimiento de las partes, conforme al artículo 53 fracción I de la Ley Federal del Trabajo',
};

export async function abrirFiniquitoPDF(empleadoId: string, c: FiniquitoConceptos) {
  const { data: emp, error } = await supabase
    .from('empleados')
    .select(
      `id, nombre, apellido_paterno, apellido_materno, rfc, curp, nss, fecha_ingreso, empresa_id,
       puesto:puestos(nombre), sucursal:sucursales(nombre, direccion)`,
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

  const nombre = [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ');
  const ciudadFecha = `${empresa?.ciudad ?? '_______________'}, a ${fmtFecha(c.fechaBaja)}`;
  const liquidacionAplica = c.causa === 'despido_injustificado';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Finiquito · ${nombre}</title>
<style>
  @page { size: letter; margin: 18mm 20mm; }
  body{font-family:'Times New Roman',serif;color:#000;font-size:12px;line-height:1.6;margin:0}
  h1{text-align:center;font-size:16px;margin:0 0 4px;letter-spacing:1px}
  h2{text-align:center;font-size:12px;font-weight:normal;color:#444;margin:0 0 24px}
  h3{font-size:12px;background:#e5e5e5;padding:4px 6px;margin:18px 0 8px;border-left:3px solid #000}
  p{text-align:justify;margin:8px 0}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{border:1px solid #555;padding:5px 8px;font-size:11px}
  th{background:#e5e5e5;text-align:left}
  td.r{text-align:right;font-variant-numeric:tabular-nums}
  .header{text-align:right;font-size:11px;color:#444;margin-bottom:14px}
  .total{background:#fffbe6;font-weight:bold}
  .firma{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
  .firma .box{text-align:center;border-top:1px solid #000;padding-top:6px;font-size:11px}
  .negro{font-weight:bold}
  .small{font-size:10px;color:#444}
  @media print { .no-print{display:none} }
</style></head><body>

<div class="header">
  ${empresa?.razon_social ?? '<span style="color:#a00">[ASIGNA UNA EMPRESA AL EMPLEADO]</span>'}<br/>
  ${empresa?.rfc ? `RFC: ${empresa.rfc}<br/>` : ''}
  ${empresa?.registro_patronal_imss ? `Registro Patronal IMSS: ${empresa.registro_patronal_imss}<br/>` : ''}
  ${ciudadFecha}
</div>

<h1>CONVENIO DE TERMINACIÓN DE LA RELACIÓN LABORAL Y FINIQUITO</h1>
<h2>Conforme a la Ley Federal del Trabajo</h2>

<p>
  En la ciudad de <span class="negro">${empresa?.ciudad ?? '_____________'}</span>, a los
  <span class="negro">${fmtFecha(c.fechaBaja)}</span>, comparecen por una parte
  <span class="negro">${empresa?.razon_social ?? '_____________'}</span>${empresa?.rfc ? `, con Registro Federal de Contribuyentes <span class="negro">${empresa.rfc}</span>` : ''},
  representada en este acto por <span class="negro">${empresa?.representante_legal ?? '_____________'}</span> en su carácter de
  <span class="negro">${empresa?.representante_puesto ?? 'Representante Legal'}</span>, a quien en lo sucesivo se le denominará "<b>EL PATRÓN</b>", y por la otra parte
  el(la) C. <span class="negro">${nombre}</span>, con RFC <span class="negro">${e.rfc ?? '_____________'}</span>,
  CURP <span class="negro">${e.curp ?? '_____________'}</span>${e.nss ? ` y NSS <span class="negro">${e.nss}</span>` : ''},
  a quien en lo sucesivo se le denominará "<b>EL TRABAJADOR</b>", quienes manifiestan tener celebrado el presente
  <b>convenio de terminación de la relación laboral y finiquito</b> al tenor de las siguientes:
</p>

<h3>D E C L A R A C I O N E S</h3>

<p>
  <b>I.</b> "EL TRABAJADOR" prestó sus servicios subordinados a "EL PATRÓN" desempeñando el puesto de
  <span class="negro">${e.puesto?.nombre ?? '_____________'}</span>${e.sucursal?.nombre ? ` en ${e.sucursal.nombre}` : ''},
  desde el <span class="negro">${fmtFecha(e.fecha_ingreso)}</span> hasta el
  <span class="negro">${fmtFecha(c.fechaBaja)}</span>, percibiendo un salario mensual integrado de
  <span class="negro">${fmtMXN.format(c.sueldoMensual)}</span>, equivalente a un salario diario de
  <span class="negro">${fmtMXN.format(c.salarioDiario)}</span> y un salario diario integrado de
  <span class="negro">${fmtMXN.format(c.salarioDiarioIntegrado)}</span>.
</p>

<p>
  <b>II.</b> La relación laboral concluye con motivo de la <b>${causaTexto[c.causa]}</b>.
</p>

<p>
  <b>III.</b> Ambas partes reconocen mutuamente la personalidad con que se ostentan y la veracidad
  de las declaraciones anteriores, por lo que están conformes en sujetarse a las siguientes:
</p>

<h3>C L Á U S U L A S</h3>

<p>
  <b>PRIMERA.</b> "EL PATRÓN" entrega en este acto a "EL TRABAJADOR", y éste recibe a su entera satisfacción,
  la cantidad líquida de <span class="negro">${fmtMXN.format(c.granTotal)}</span> ${numeroALetras(c.granTotal)},
  por concepto de finiquito${liquidacionAplica ? ' y liquidación' : ''}, integrada en los siguientes términos:
</p>

<table>
  <thead>
    <tr><th>Concepto</th><th style="text-align:right;width:30%">Importe</th></tr>
  </thead>
  <tbody>
    ${linea('Sueldo pendiente', c.sueldoPendiente)}
    ${linea('Aguinaldo proporcional (Art. 87 LFT)', c.aguinaldoProp)}
    ${linea('Vacaciones proporcionales (Art. 76 LFT)', c.vacacionesProp)}
    ${linea('Prima vacacional 25% (Art. 80 LFT)', c.primaVacacional)}
    ${linea('Vacaciones pendientes', c.vacPendientesMonto)}
    ${
      liquidacionAplica
        ? linea('Indemnización 90 días SDI (Art. 48 y 50 LFT)', c.indemn3meses) +
          linea('20 días por año de servicio SDI (Art. 50 fr. II LFT)', c.prima20)
        : ''
    }
    ${
      c.primaAntiguedad > 0
        ? linea('Prima de antigüedad: 12 días por año, tope 2 SMG (Art. 162 LFT)', c.primaAntiguedad)
        : ''
    }
    <tr class="total"><td><b>TOTAL BRUTO</b></td><td class="r"><b>${fmtMXN.format(c.granTotal)}</b></td></tr>
  </tbody>
</table>

<p class="small">
  * Las retenciones de ISR aplicables sobre los conceptos gravables (Art. 95 LISR) deben calcularse
  por separado por el área contable y aplicarse sobre el total bruto antes de la firma.
</p>

<p>
  <b>SEGUNDA.</b> Con la entrega de la cantidad mencionada en la cláusula anterior, "EL TRABAJADOR" otorga
  a "EL PATRÓN" el más amplio y eficaz <b>finiquito</b> que en derecho proceda, manifestando que no se
  reserva acción ni derecho alguno que ejercitar en contra de "EL PATRÓN" o de quien sus derechos
  represente, por concepto de salarios, vacaciones, prima vacacional, aguinaldo, prima de antigüedad,
  indemnización constitucional, horas extras, días de descanso, séptimo día, días festivos, comisiones,
  bonos, premios o cualquier otra prestación derivada de la relación laboral que existió entre las partes.
</p>

<p>
  <b>TERCERA.</b> "EL TRABAJADOR" manifiesta que durante el tiempo que duró la relación laboral
  recibió íntegramente todas y cada una de las prestaciones a que tenía derecho, así como el pago
  oportuno de su salario y demás contraprestaciones legales y contractuales.
</p>

<p>
  <b>CUARTA.</b> Las partes manifiestan que en la celebración del presente convenio no existe dolo,
  error, mala fe, lesión, violencia ni vicio alguno del consentimiento que pudiera invalidarlo, por lo
  que renuncian a invocar cualquier acción tendiente a su nulidad.
</p>

<p style="margin-top:24px">
  Leído el presente convenio por las partes y enteradas de su contenido, alcance y efectos legales,
  lo firman de conformidad por duplicado en la ciudad y fecha indicadas al inicio del mismo.
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
    alert('Permite ventanas emergentes para generar el documento.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

function linea(label: string, monto: number): string {
  if (!monto || monto <= 0) return '';
  return `<tr><td>${label}</td><td class="r">${fmtMXN.format(monto)}</td></tr>`;
}

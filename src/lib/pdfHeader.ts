// Genera bloques de encabezado y pie de página con datos de la empresa principal
// para usar en cualquier reporte PDF imprimible.

import { supabase } from './supabase';

export type EmpresaPdf = {
  razon_social: string;
  rfc: string | null;
  domicilio_fiscal: string | null;
  ciudad: string | null;
  estado: string | null;
  cp: string | null;
  telefono: string | null;
  email: string | null;
  registro_patronal_imss: string | null;
  logo_url: string | null;
};

export async function getEmpresaById(id: string | null | undefined): Promise<EmpresaPdf | null> {
  if (!id) return null;
  const { data } = await supabase
    .from('empresas')
    .select(
      'razon_social, rfc, domicilio_fiscal, ciudad, estado, cp, telefono, email, registro_patronal_imss, logo_url',
    )
    .eq('id', id)
    .maybeSingle();
  return (data as EmpresaPdf | null) ?? null;
}

/**
 * Resuelve la empresa para el membrete: si se pasa empresaId la usa,
 * si no, regresa la empresa marcada como principal (o la primera activa).
 */
export async function resolverEmpresaParaPdf(empresaId?: string | null): Promise<EmpresaPdf | null> {
  if (empresaId) {
    const e = await getEmpresaById(empresaId);
    if (e) return e;
  }
  return getEmpresaPrincipal();
}

export async function getEmpresaPrincipal(): Promise<EmpresaPdf | null> {
  const { data: principal } = await supabase
    .from('empresas')
    .select(
      'razon_social, rfc, domicilio_fiscal, ciudad, estado, cp, telefono, email, registro_patronal_imss, logo_url',
    )
    .eq('activo', true)
    .eq('principal', true)
    .maybeSingle();
  if (principal) return principal as EmpresaPdf;
  const { data } = await supabase
    .from('empresas')
    .select(
      'razon_social, rfc, domicilio_fiscal, ciudad, estado, cp, telefono, email, registro_patronal_imss, logo_url',
    )
    .eq('activo', true)
    .order('razon_social')
    .limit(1)
    .maybeSingle();
  return (data as EmpresaPdf | null) ?? null;
}

export function pdfHeaderHTML(emp: EmpresaPdf | null, titulo: string, subtitulo?: string): string {
  if (!emp) {
    return `<div class="rep-header" style="border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px">
      <h1 style="margin:0;font-size:18px;color:#0f172a">${titulo}</h1>
      ${subtitulo ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${subtitulo}</div>` : ''}
    </div>`;
  }
  const direccion = [emp.domicilio_fiscal, emp.ciudad, emp.estado, emp.cp]
    .filter(Boolean)
    .join(', ');
  return `<div class="rep-header" style="border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px;display:flex;align-items:center;gap:14px">
    ${
      emp.logo_url
        ? `<img src="${emp.logo_url}" style="height:48px;max-width:140px;object-fit:contain" alt="" />`
        : ''
    }
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:#0f172a">${emp.razon_social}</div>
      <div style="font-size:9px;color:#64748b;line-height:1.4">
        ${emp.rfc ? `RFC: ${emp.rfc}` : ''}
        ${emp.registro_patronal_imss ? ` · Reg. Patronal: ${emp.registro_patronal_imss}` : ''}
        ${direccion ? `<br/>${direccion}` : ''}
        ${emp.telefono ? ` · Tel: ${emp.telefono}` : ''}
        ${emp.email ? ` · ${emp.email}` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:600;color:#0f172a">${titulo}</div>
      ${subtitulo ? `<div style="font-size:10px;color:#64748b">${subtitulo}</div>` : ''}
    </div>
  </div>`;
}

export function pdfFooterHTML(emp: EmpresaPdf | null): string {
  const fecha = new Date().toLocaleString('es-MX');
  const empresa = emp ? `${emp.razon_social}${emp.rfc ? ` · RFC ${emp.rfc}` : ''}` : 'Portal RRHH';
  return `<div class="rep-footer" style="margin-top:24px;padding-top:8px;border-top:1px solid #cbd5e1;font-size:9px;color:#64748b;display:flex;justify-content:space-between">
    <span>${empresa}</span>
    <span>Generado: ${fecha}</span>
  </div>`;
}

// Sistema semántico de colores por módulo. Tailwind purga clases dinámicas,
// así que aquí se enumeran las strings completas para que el JIT las detecte.

export type Tone =
  | 'indigo'
  | 'slate'
  | 'emerald'
  | 'green'
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'red'
  | 'pink'
  | 'orange'
  | 'sky';

export const moduloTone: Record<string, Tone> = {
  // Personas / corporativo
  empleados: 'indigo',
  organigrama: 'indigo',
  usuarios: 'indigo',
  mi_portal: 'indigo',

  // Catálogos / configuración
  empresas: 'slate',
  sucursales: 'slate',
  puestos: 'slate',
  reportes: 'slate',
  auditoria: 'slate',

  // Operación / personas (verdes)
  asistencia: 'emerald',
  vacaciones: 'green',
  calendario: 'cyan',

  // Procesos
  horarios: 'violet',
  capacitacion: 'sky',
  onboarding: 'sky',
  documentos: 'sky',

  // Atención / alertas (cálidos)
  incidencias: 'amber',
  actas: 'red',
  nom035: 'pink',
  notificaciones: 'amber',

  // Dinero (verde esmeralda / naranja)
  nomina: 'emerald',
  calculadoras: 'emerald',
  prestamos: 'orange',
};

export type ToneClasses = {
  activeBg: string;
  activeText: string;
  hoverBg: string;
  icon: string;
  iconActive: string;
  accent: string;       // borde
  headerBg: string;     // bg sutil para headers
  headerBorder: string; // borde de acento del header
  badge: string;        // bg-{x}-100 text-{x}-700
  pill: string;         // bg-{x}-600 text-white
};

export const toneClasses: Record<Tone, ToneClasses> = {
  indigo: {
    activeBg: 'bg-indigo-50',
    activeText: 'text-indigo-700',
    hoverBg: 'hover:bg-indigo-50/60',
    icon: 'text-slate-400 group-hover:text-indigo-600',
    iconActive: 'text-indigo-600',
    accent: 'border-indigo-500',
    headerBg: 'bg-indigo-50/40',
    headerBorder: 'border-l-4 border-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    pill: 'bg-indigo-600 text-white',
  },
  slate: {
    activeBg: 'bg-slate-100',
    activeText: 'text-slate-800',
    hoverBg: 'hover:bg-slate-100',
    icon: 'text-slate-400 group-hover:text-slate-600',
    iconActive: 'text-slate-700',
    accent: 'border-slate-500',
    headerBg: 'bg-slate-50',
    headerBorder: 'border-l-4 border-slate-500',
    badge: 'bg-slate-100 text-slate-700',
    pill: 'bg-slate-600 text-white',
  },
  emerald: {
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-700',
    hoverBg: 'hover:bg-emerald-50/60',
    icon: 'text-slate-400 group-hover:text-emerald-600',
    iconActive: 'text-emerald-600',
    accent: 'border-emerald-500',
    headerBg: 'bg-emerald-50/40',
    headerBorder: 'border-l-4 border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    pill: 'bg-emerald-600 text-white',
  },
  green: {
    activeBg: 'bg-green-50',
    activeText: 'text-green-700',
    hoverBg: 'hover:bg-green-50/60',
    icon: 'text-slate-400 group-hover:text-green-600',
    iconActive: 'text-green-600',
    accent: 'border-green-500',
    headerBg: 'bg-green-50/40',
    headerBorder: 'border-l-4 border-green-500',
    badge: 'bg-green-100 text-green-700',
    pill: 'bg-green-600 text-white',
  },
  cyan: {
    activeBg: 'bg-cyan-50',
    activeText: 'text-cyan-700',
    hoverBg: 'hover:bg-cyan-50/60',
    icon: 'text-slate-400 group-hover:text-cyan-600',
    iconActive: 'text-cyan-600',
    accent: 'border-cyan-500',
    headerBg: 'bg-cyan-50/40',
    headerBorder: 'border-l-4 border-cyan-500',
    badge: 'bg-cyan-100 text-cyan-700',
    pill: 'bg-cyan-600 text-white',
  },
  violet: {
    activeBg: 'bg-violet-50',
    activeText: 'text-violet-700',
    hoverBg: 'hover:bg-violet-50/60',
    icon: 'text-slate-400 group-hover:text-violet-600',
    iconActive: 'text-violet-600',
    accent: 'border-violet-500',
    headerBg: 'bg-violet-50/40',
    headerBorder: 'border-l-4 border-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    pill: 'bg-violet-600 text-white',
  },
  amber: {
    activeBg: 'bg-amber-50',
    activeText: 'text-amber-700',
    hoverBg: 'hover:bg-amber-50/60',
    icon: 'text-slate-400 group-hover:text-amber-600',
    iconActive: 'text-amber-600',
    accent: 'border-amber-500',
    headerBg: 'bg-amber-50/40',
    headerBorder: 'border-l-4 border-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    pill: 'bg-amber-600 text-white',
  },
  red: {
    activeBg: 'bg-red-50',
    activeText: 'text-red-700',
    hoverBg: 'hover:bg-red-50/60',
    icon: 'text-slate-400 group-hover:text-red-600',
    iconActive: 'text-red-600',
    accent: 'border-red-500',
    headerBg: 'bg-red-50/40',
    headerBorder: 'border-l-4 border-red-500',
    badge: 'bg-red-100 text-red-700',
    pill: 'bg-red-600 text-white',
  },
  pink: {
    activeBg: 'bg-pink-50',
    activeText: 'text-pink-700',
    hoverBg: 'hover:bg-pink-50/60',
    icon: 'text-slate-400 group-hover:text-pink-600',
    iconActive: 'text-pink-600',
    accent: 'border-pink-500',
    headerBg: 'bg-pink-50/40',
    headerBorder: 'border-l-4 border-pink-500',
    badge: 'bg-pink-100 text-pink-700',
    pill: 'bg-pink-600 text-white',
  },
  orange: {
    activeBg: 'bg-orange-50',
    activeText: 'text-orange-700',
    hoverBg: 'hover:bg-orange-50/60',
    icon: 'text-slate-400 group-hover:text-orange-600',
    iconActive: 'text-orange-600',
    accent: 'border-orange-500',
    headerBg: 'bg-orange-50/40',
    headerBorder: 'border-l-4 border-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    pill: 'bg-orange-600 text-white',
  },
  sky: {
    activeBg: 'bg-sky-50',
    activeText: 'text-sky-700',
    hoverBg: 'hover:bg-sky-50/60',
    icon: 'text-slate-400 group-hover:text-sky-600',
    iconActive: 'text-sky-600',
    accent: 'border-sky-500',
    headerBg: 'bg-sky-50/40',
    headerBorder: 'border-l-4 border-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    pill: 'bg-sky-600 text-white',
  },
};

export function getToneFor(modulo: string | null | undefined): ToneClasses {
  if (!modulo) return toneClasses.indigo;
  const t = moduloTone[modulo] ?? 'indigo';
  return toneClasses[t];
}

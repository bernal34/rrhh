import { useState } from 'react';
import TurnosPanel from './TurnosPanel';
import GruposPanel from './GruposPanel';

export default function HorariosList() {
  const [tab, setTab] = useState<'turnos' | 'grupos'>('grupos');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Horarios</h1>

      <div className="flex gap-1 border-b border-slate-200">
        {(['grupos', 'turnos'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'grupos' ? 'Grupos de horario' : 'Turnos'}
          </button>
        ))}
      </div>

      {tab === 'turnos' && <TurnosPanel />}
      {tab === 'grupos' && <GruposPanel />}
    </div>
  );
}

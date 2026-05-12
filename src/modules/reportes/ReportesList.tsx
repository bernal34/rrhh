import { Tabs } from '@/components/ui/Tabs';
import ReporteDiario from './ReporteDiario';
import ResumenMensual from './ResumenMensual';
import CalendarioMensual from './CalendarioMensual';
import TopRetardosFaltas from './TopRetardosFaltas';

export default function ReportesList() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <Tabs
        tabs={[
          { key: 'diario', label: 'Diario / Rango', content: <ReporteDiario /> },
          { key: 'resumen', label: 'Resumen mensual', content: <ResumenMensual /> },
          { key: 'calendario', label: 'Calendario mensual', content: <CalendarioMensual /> },
          { key: 'top', label: 'Top retardos / faltas', content: <TopRetardosFaltas /> },
        ]}
      />
    </div>
  );
}

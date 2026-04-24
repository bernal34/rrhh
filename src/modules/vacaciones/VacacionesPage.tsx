import { Tabs } from '@/components/ui/Tabs';
import SaldosPanel from './SaldosPanel';
import SolicitudesPanel from './SolicitudesPanel';

export default function VacacionesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Vacaciones</h1>
      <Tabs
        tabs={[
          { key: 'saldos', label: 'Saldos', content: <SaldosPanel /> },
          { key: 'solicitudes', label: 'Solicitudes', content: <SolicitudesPanel /> },
        ]}
      />
    </div>
  );
}

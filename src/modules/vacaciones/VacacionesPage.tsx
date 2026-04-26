import { Palmtree } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import PageHeader from '@/components/PageHeader';
import SaldosPanel from './SaldosPanel';
import SolicitudesPanel from './SolicitudesPanel';

export default function VacacionesPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        modulo="vacaciones"
        icon={Palmtree}
        title="Vacaciones"
        subtitle="Gestión de saldos y solicitudes según LFT 2023"
      />
      <Tabs
        tabs={[
          { key: 'saldos', label: 'Saldos', content: <SaldosPanel /> },
          { key: 'solicitudes', label: 'Solicitudes', content: <SolicitudesPanel /> },
        ]}
      />
    </div>
  );
}

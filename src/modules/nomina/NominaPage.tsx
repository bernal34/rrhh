import { Tabs } from '@/components/ui/Tabs';
import NominaList from './NominaList';
import ConceptosPanel from './ConceptosPanel';
import BonosPanel from './BonosPanel';

export default function NominaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nómina</h1>
      <Tabs
        tabs={[
          { key: 'prenominas', label: 'Prenóminas', content: <NominaList /> },
          { key: 'conceptos', label: 'Conceptos', content: <ConceptosPanel /> },
          { key: 'bonos', label: 'Reglas de bono', content: <BonosPanel /> },
        ]}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Puesto, Sucursal, listPuestos, listSucursales } from '@/services/catalogosService';

export function useCatalogos() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listSucursales(), listPuestos()])
      .then(([s, p]) => {
        setSucursales(s);
        setPuestos(p);
      })
      .finally(() => setLoading(false));
  }, []);

  return { sucursales, puestos, loading };
}

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function RequireModulo({
  modulo,
  children,
}: {
  modulo: string;
  children: React.ReactNode;
}) {
  const { puedeVer, loading } = useAuth();
  if (loading) return null;
  if (!puedeVer(modulo)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

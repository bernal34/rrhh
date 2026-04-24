import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RequireModulo from './components/RequireModulo';
import Login from './pages/Login';
import Dashboard from './modules/Dashboard';
import EmpleadosList from './modules/empleados/EmpleadosList';
import SucursalesList from './modules/sucursales/SucursalesList';
import PuestosList from './modules/puestos/PuestosList';
import NominaPage from './modules/nomina/NominaPage';
import AsistenciaList from './modules/asistencia/AsistenciaList';
import DocumentosList from './modules/documentos/DocumentosList';
import ReportesList from './modules/reportes/ReportesList';
import HorariosList from './modules/horarios/HorariosList';
import IncidenciasList from './modules/incidencias/IncidenciasList';
import ActasList from './modules/actas/ActasList';
import UsuariosList from './modules/usuarios/UsuariosList';
import VacacionesPage from './modules/vacaciones/VacacionesPage';

const r = (modulo: string, el: React.ReactNode) => (
  <RequireModulo modulo={modulo}>{el}</RequireModulo>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/empleados" element={r('empleados', <EmpleadosList />)} />
                <Route path="/sucursales" element={r('sucursales', <SucursalesList />)} />
                <Route path="/puestos" element={r('puestos', <PuestosList />)} />
                <Route path="/horarios" element={r('horarios', <HorariosList />)} />
                <Route path="/asistencia" element={r('asistencia', <AsistenciaList />)} />
                <Route path="/incidencias" element={r('incidencias', <IncidenciasList />)} />
                <Route path="/vacaciones" element={r('vacaciones', <VacacionesPage />)} />
                <Route path="/actas" element={r('actas', <ActasList />)} />
                <Route path="/nomina" element={r('nomina', <NominaPage />)} />
                <Route path="/documentos" element={r('documentos', <DocumentosList />)} />
                <Route path="/reportes" element={r('reportes', <ReportesList />)} />
                <Route path="/usuarios" element={r('usuarios', <UsuariosList />)} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

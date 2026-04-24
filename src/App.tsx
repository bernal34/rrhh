import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './modules/Dashboard';
import EmpleadosList from './modules/empleados/EmpleadosList';
import SucursalesList from './modules/sucursales/SucursalesList';
import NominaPage from './modules/nomina/NominaPage';
import AsistenciaList from './modules/asistencia/AsistenciaList';
import DocumentosList from './modules/documentos/DocumentosList';
import ReportesList from './modules/reportes/ReportesList';
import HorariosList from './modules/horarios/HorariosList';
import IncidenciasList from './modules/incidencias/IncidenciasList';
import ActasList from './modules/actas/ActasList';

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
                <Route path="/empleados" element={<EmpleadosList />} />
                <Route path="/sucursales" element={<SucursalesList />} />
                <Route path="/horarios" element={<HorariosList />} />
                <Route path="/asistencia" element={<AsistenciaList />} />
                <Route path="/incidencias" element={<IncidenciasList />} />
                <Route path="/actas" element={<ActasList />} />
                <Route path="/nomina" element={<NominaPage />} />
                <Route path="/documentos" element={<DocumentosList />} />
                <Route path="/reportes" element={<ReportesList />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { PatientRegistry } from './pages/PatientRegistry';
import { PatientProfile } from './pages/PatientProfile';
import { ECRFEntry } from './pages/ECRFEntry';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <MainLayout>
            <Navigate to="/dashboard" replace />
          </MainLayout>
        } />

        <Route path="/dashboard" element={
          <MainLayout>
            <Dashboard />
          </MainLayout>
        } />

        <Route path="/patients" element={
          <MainLayout>
            <PatientRegistry />
          </MainLayout>
        } />

        <Route path="/patients/:id" element={
          <MainLayout>
            <PatientProfile />
          </MainLayout>
        } />

        <Route path="/ecrf" element={
          <MainLayout>
            <ECRFEntry />
          </MainLayout>
        } />

        <Route path="/safety" element={
          <MainLayout>
            <div className="p-8"><h1>Safety Monitoring (Coming Soon)</h1></div>
          </MainLayout>
        } />

        <Route path="/labs" element={
          <MainLayout>
            <div className="p-8"><h1>Lab Results (Coming Soon)</h1></div>
          </MainLayout>
        } />

        <Route path="/stats" element={
          <MainLayout>
            <div className="p-8"><h1>Statistics (Coming Soon)</h1></div>
          </MainLayout>
        } />

        <Route path="/compliance" element={
          <MainLayout>
            <div className="p-8"><h1>Compliance (Coming Soon)</h1></div>
          </MainLayout>
        } />

        <Route path="*" element={
          <MainLayout>
            {/* Fallback for now */}
            <div className="p-8">Page Not Found</div>
          </MainLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

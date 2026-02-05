import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { PatientRegistry } from './pages/Principal_Investigator/PatientRegistry';
import { CreatePatient } from './pages/Principal_Investigator/CreatePatient';
import { PatientProfile } from './pages/Principal_Investigator/PatientProfile';
import { ECRFEntry } from './pages/study_coordinator/ECRFEntry/ECRFEntry';
import { PatientCheckIn } from './pages/study_coordinator/PatientCheckIn';
import { VisitScheduler } from './pages/study_coordinator/VisitScheduler';
import { LabResultsEntry } from './pages/study_coordinator/LabResultsEntry';

function App() {
  return (


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

      <Route path="/patients/new" element={
        <MainLayout>
          <CreatePatient />
        </MainLayout>
      } />

      <Route path="/patients/:patient_id" element={
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

      {/* Coordinator Routes */}
      <Route path="/checkin" element={
        <MainLayout>
          <PatientCheckIn />
        </MainLayout>
      } />

      <Route path="/schedule" element={
        <MainLayout>
          <VisitScheduler />
        </MainLayout>
      } />

      <Route path="/labs/entry" element={
        <MainLayout>
          <LabResultsEntry />
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

  );
}

export default App;

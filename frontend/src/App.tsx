import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';

// PI pages
import { PatientRegistry } from './pages/Principal_Investigator/PatientRegistry';
import { PatientProfile } from './pages/Principal_Investigator/PatientProfile';
import { LabResults } from './pages/Principal_Investigator/LabResults';
import { PISafetyMonitoring } from './pages/Principal_Investigator/PISafetyMonitoring';

// Screening (shared PI + coordinator)
import { Screening } from './pages/Principal_Investigator/Screening';
import { ScreeningReview } from './pages/Principal_Investigator/ScreeningReview';
import { ScreeningQueue } from './pages/Principal_Investigator/ScreeningQueue';

// Coordinator pages
import { ECRFEntry } from './pages/study_coordinator/ECRFEntry/ECRFEntry';
import { VisitManagement } from './pages/study_coordinator/VisitManagement';
import { LabResultsEntry } from './pages/study_coordinator/LabResultsEntry';

// Safety Monitor pages
import { AllPatients } from './pages/safety_monitor/AllPatients';
import { AdverseEvents } from './pages/safety_monitor/AdverseEvents';
import { SAEManagement } from './pages/safety_monitor/SAEManagement';
import { SafetyAlerts } from './pages/safety_monitor/SafetyAlerts';
import { SafetySignals } from './pages/safety_monitor/SafetySignals';
import { DSMBMeetings } from './pages/safety_monitor/DSMBMeetings';
import { Unblinding } from './pages/safety_monitor/Unblinding';
import { SafetyReports } from './pages/safety_monitor/SafetyReports';

// Data Manager pages
import { DataQueries } from './pages/DataQueries/DataQueries';
import { DataReview } from './pages/DataReview/DataReview';
import { DatabaseLock } from './pages/DatabaseLock/DatabaseLock';
import { CDISCExport } from './pages/CDISCExport/CDISCExport';
import { AuditTrail } from './pages/AuditTrail/AuditTrail';
import { Protocols } from './pages/Protocols/Protocols';

// Statistician pages
import { AnalysisDatasets } from './pages/AnalysisDatasets/AnalysisDatasets';
import { SurvivalAnalysis } from './pages/SurvivalAnalysis/SurvivalAnalysis';
import { PowerAnalysis } from './pages/PowerAnalysis/PowerAnalysis';
import { RandomizationBalance } from './pages/RandomizationBalance/RandomizationBalance';
import { SafetyStatistics } from './pages/SafetyStatistics/SafetyStatistics';
import { InterimAnalysis } from './pages/InterimAnalysis/InterimAnalysis';
import { StatCDISCExport } from './pages/StatCDISCExport/StatCDISCExport';

// Admin pages
import { TrialManagement } from './pages/admin/TrialManagement';
import { TrialForm } from './pages/admin/TrialForm';
import { TrialDetail } from './pages/admin/TrialDetail';
import { SiteManagement } from './pages/admin/SiteManagement';
import { SiteDetail } from './pages/admin/SiteDetail';
import { UserManagement } from './pages/admin/UserManagement';
import { UserAccessLog } from './pages/admin/UserAccessLog';
import { LockManagement } from './pages/admin/LockManagement';
import { AdminAuditTrail } from './pages/admin/AdminAuditTrail';
//import { SystemSettings } from './pages/admin/SystemSettings';
import { SiteEdit } from './pages/admin/SiteEdit';


const W = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280' }}>Loading session…</div>;
  
  
  if (!user) return <Navigate to="/login" replace />;
  
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />; 
  }
  
  return <MainLayout>{children}</MainLayout>;
};

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Root & Dashboard */}
      <Route path="/" element={<W><Navigate to="/dashboard" replace /></W>} />
      <Route path="/dashboard" element={<W><Dashboard /></W>} />

      {/* Patient Registry & Screening (For both PI and SC) */}
      <Route path="/patients" element={<W allowedRoles={['Principal_Investigator','Study_Coordinator']}><PatientRegistry /></W>} />
      <Route path="/patients/screening" element={<W allowedRoles={['Principal_Investigator','Study_Coordinator']}><ScreeningQueue /></W>} />
      <Route path="/patients/screening/:patient_id" element={
        <W allowedRoles={['Principal_Investigator','Study_Coordinator']}>{user?.role === 'Principal_Investigator' ? <ScreeningReview /> : <Screening />}</W>
      } />
      <Route path="/patients/:patient_id" element={<W allowedRoles={['Principal_Investigator','Study_Coordinator']}><PatientProfile /></W>} />
      <Route path="/safety" element={<W allowedRoles={['Principal_Investigator']}><PISafetyMonitoring /></W>} />

      {/* eCRF */}
      <Route path="/ecrf" element={<W allowedRoles={['Principal_Investigator','Study_Coordinator']}><ECRFEntry /></W>} />

      {/* PI: Lab Results List */}
      <Route path="/labs" element={<W allowedRoles={['Principal_Investigator']}><LabResults /></W>} />

      {/*Coordinator Routes*/}
      <Route path="/visits" element={<W allowedRoles={['Study_Coordinator']}><VisitManagement /></W>} />
      <Route path="/labs/entry" element={<W allowedRoles={['Study_Coordinator']}><LabResultsEntry /></W>} />

      {/* Safety Monitor Routes */}
      <Route path="/sm/patients" element={<W allowedRoles={['Safety_Monitor']}><AllPatients /></W>} />
      <Route path="/safety/ae" element={<W allowedRoles={['Safety_Monitor']}><AdverseEvents /></W>} />
      <Route path="/safety/sae" element={<W allowedRoles={['Safety_Monitor']}><SAEManagement /></W>} />
      <Route path="/safety/alerts" element={<W allowedRoles={['Safety_Monitor']}><SafetyAlerts /></W>} />
      <Route path="/safety/signals" element={<W allowedRoles={['Safety_Monitor']}><SafetySignals /></W>} />
      <Route path="/safety/dsmb" element={<W allowedRoles={['Safety_Monitor']}><DSMBMeetings /></W>} />
      <Route path="/safety/unblinding" element={<W allowedRoles={['Safety_Monitor']}><Unblinding /></W>} />
      <Route path="/safety/reports" element={<W allowedRoles={['Safety_Monitor']}><SafetyReports /></W>} />

      {/*Data Manager Routes */}
      <Route path="/data-management/queries" element={<W allowedRoles={['Data_Manager']}><DataQueries /></W>} />
      <Route path="/data-management/review" element={<W allowedRoles={['Data_Manager']}><DataReview /></W>} />
      <Route path="/data-management/lock" element={<W allowedRoles={['Data_Manager', 'Statistician']}><DatabaseLock /></W>} />
      <Route path="/data-management/export" element={<W allowedRoles={['Data_Manager']}><CDISCExport /></W>} />
      <Route path="/protocols" element={<W allowedRoles={['Data_Manager']}><Protocols /></W>} />

      {/* ── Statistician Routes ───────────────────────────── */}
      <Route path="/statistics/datasets" element={<W allowedRoles={['Statistician']}><AnalysisDatasets /></W>} />
      <Route path="/statistics/survival" element={<W allowedRoles={['Statistician']}><SurvivalAnalysis /></W>} />
      <Route path="/statistics/power" element={<W allowedRoles={['Statistician']}><PowerAnalysis /></W>} />
      <Route path="/statistics/balance" element={<W allowedRoles={['Statistician']}><RandomizationBalance /></W>} />
      <Route path="/statistics/safety" element={<W allowedRoles={['Statistician']}><SafetyStatistics /></W>} />
      <Route path="/statistics/interim" element={<W allowedRoles={['Statistician']}><InterimAnalysis /></W>} />
      <Route path="/statistics/export" element={<W allowedRoles={['Statistician']}><StatCDISCExport /></W>} />

      {/* ── Admin Routes ──────────────────────────────────── */}
      <Route path="/admin/trials" element={<W allowedRoles={['System_Admin']}><TrialManagement /></W>} />
      <Route path="/admin/trials/new" element={<W allowedRoles={['System_Admin']}><TrialForm /></W>} />
      <Route path="/admin/trials/:trialId" element={<W allowedRoles={['System_Admin']}><TrialDetail /></W>} />
      <Route path="/admin/trials/:trialId/edit" element={<W allowedRoles={['System_Admin']}><TrialForm /></W>} />
      <Route path="/admin/sites" element={<W allowedRoles={['System_Admin']}><SiteManagement /></W>} />
      <Route path="/admin/sites/:siteId" element={<W allowedRoles={['System_Admin']}><SiteDetail /></W>} />
      <Route path="/admin/sites/:siteId/edit" element={<W allowedRoles={['System_Admin']}><SiteEdit /></W>} />
      <Route path="/admin/users" element={<W allowedRoles={['System_Admin']}><UserManagement /></W>} />
      <Route path="/admin/users/:userId" element={<W allowedRoles={['System_Admin']}><UserAccessLog /></W>} />
      <Route path="/admin/locks" element={<W allowedRoles={['System_Admin']}><LockManagement /></W>} />
      {/* <Route path="/admin/settings" element={<W allowedRoles={['System_Admin']}><SystemSettings /></W>} /> */}

      {/*Shared: Audit Trail (role-aware) */}
      <Route path="/audit" element={<W allowedRoles={['System_Admin', 'Data_Manager']}>{user?.role === 'Data_Manager' ? <AuditTrail /> : <AdminAuditTrail />}</W>} />

      {/* Catch-all*/}
      <Route path="*" element={<W><div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)' }}><h2>404 — Page Not Found</h2><p>The page you're looking for doesn't exist.</p></div></W>} />
    </Routes>
  );
}

export default App;

import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';

// PI pages
import { PatientRegistry } from './pages/Principal_Investigator/PatientRegistry';
import { PatientProfile } from './pages/Principal_Investigator/PatientProfile';
import { LabResults } from './pages/Principal_Investigator/LabResults';

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
import { SystemSettings } from './pages/admin/SystemSettings';

/* ── Protected wrapper: redirects to /login if not authenticated ────── */
const W = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280' }}>Loading session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <MainLayout>{children}</MainLayout>;
};

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* ── Root & Dashboard ─────────────────────────────── */}
      <Route path="/" element={<W><Navigate to="/dashboard" replace /></W>} />
      <Route path="/dashboard" element={<W><Dashboard /></W>} />

      {/* ── Patient Registry & Screening ──────────────────── */}
      <Route path="/patients" element={<W><PatientRegistry /></W>} />
      <Route path="/patients/screening" element={<W><ScreeningQueue /></W>} />
      <Route path="/patients/screening/:patient_id" element={
        <W>{user?.role === 'Principal_Investigator' ? <ScreeningReview /> : <Screening />}</W>
      } />
      <Route path="/patients/:patient_id" element={<W><PatientProfile /></W>} />

      {/* ── eCRF ──────────────────────────────────────────── */}
      <Route path="/ecrf" element={<W><ECRFEntry /></W>} />

      {/* ── PI: Lab Results ────────────────────────────────── */}
      <Route path="/labs" element={<W><LabResults /></W>} />

      {/* ── Coordinator Routes ────────────────────────────── */}
      <Route path="/visits" element={<W><VisitManagement /></W>} />
      <Route path="/labs/entry" element={<W><LabResultsEntry /></W>} />

      {/* ── Safety Monitor Routes ─────────────────────────── */}
      <Route path="/sm/patients" element={<W><AllPatients /></W>} />
      <Route path="/safety/ae" element={<W><AdverseEvents /></W>} />
      <Route path="/safety/sae" element={<W><SAEManagement /></W>} />
      <Route path="/safety/alerts" element={<W><SafetyAlerts /></W>} />
      <Route path="/safety/signals" element={<W><SafetySignals /></W>} />
      <Route path="/safety/dsmb" element={<W><DSMBMeetings /></W>} />
      <Route path="/safety/unblinding" element={<W><Unblinding /></W>} />
      <Route path="/safety/reports" element={<W><SafetyReports /></W>} />

      {/* ── Data Manager Routes ───────────────────────────── */}
      <Route path="/data-management/queries" element={<W><DataQueries /></W>} />
      <Route path="/data-management/review" element={<W><DataReview /></W>} />
      <Route path="/data-management/lock" element={<W><DatabaseLock /></W>} />
      <Route path="/data-management/export" element={<W><CDISCExport /></W>} />
      <Route path="/protocols" element={<W><Protocols /></W>} />

      {/* ── Statistician Routes ───────────────────────────── */}
      <Route path="/statistics/datasets" element={<W><AnalysisDatasets /></W>} />
      <Route path="/statistics/survival" element={<W><SurvivalAnalysis /></W>} />
      <Route path="/statistics/power" element={<W><PowerAnalysis /></W>} />
      <Route path="/statistics/balance" element={<W><RandomizationBalance /></W>} />
      <Route path="/statistics/safety" element={<W><SafetyStatistics /></W>} />
      <Route path="/statistics/interim" element={<W><InterimAnalysis /></W>} />

      {/* ── Admin Routes ──────────────────────────────────── */}
      <Route path="/admin/trials" element={<W><TrialManagement /></W>} />
      <Route path="/admin/trials/new" element={<W><TrialForm /></W>} />
      <Route path="/admin/trials/:trialId" element={<W><TrialDetail /></W>} />
      <Route path="/admin/trials/:trialId/edit" element={<W><TrialForm /></W>} />
      <Route path="/admin/sites" element={<W><SiteManagement /></W>} />
      <Route path="/admin/sites/:siteId" element={<W><SiteDetail /></W>} />
      <Route path="/admin/users" element={<W><UserManagement /></W>} />
      <Route path="/admin/users/:userId" element={<W><UserAccessLog /></W>} />
      <Route path="/admin/locks" element={<W><LockManagement /></W>} />
      <Route path="/admin/settings" element={<W><SystemSettings /></W>} />

      {/* ── Shared: Audit Trail (role-aware) ───────────────── */}
      <Route path="/audit" element={<W>{user?.role === 'Data_Manager' ? <AuditTrail /> : <AdminAuditTrail />}</W>} />

      {/* ── Catch-all ─────────────────────────────────────── */}
      <Route path="*" element={<W><div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)' }}><h2>404 — Page Not Found</h2><p>The page you're looking for doesn't exist.</p></div></W>} />
    </Routes>
  );
}

export default App;

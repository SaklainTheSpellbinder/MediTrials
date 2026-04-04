import React, { useState } from 'react';
import { PatientList, type Patient } from './PatientList';
import { ClinicalForm } from './ClinicalForm';
import { LabEntryForm } from './LabEntryForm';
import { AEEntryForm } from './AEEntryForm';
import { useQuery } from '@tanstack/react-query';
import { coordinatorAPI } from '../../../services/api';
import { Calendar, ArrowLeft, Clock, AlertCircle, CheckCircle, HeartPulse, TestTube, AlertTriangle } from 'lucide-react';
import '../Coordinator.css';

// --- Interfaces ---
interface ActiveVisit {
  visit_instance_id: number;
  visit_name: string;
  visit_number: number;
  scheduled_date: string;
  actual_visit_date: string | null;
  visit_status: string;
  trial_patient_id: string;
}

type EntryMode = 'vitals' | 'labs' | 'ae';

// --- Visit Picker step ---
const VisitPicker: React.FC<{
  patient: Patient;
  onBack: () => void;
  onSelectVisit: (visit: ActiveVisit) => void;
}> = ({ patient, onBack, onSelectVisit }) => {

  const { data: visits = [], isLoading } = useQuery<ActiveVisit[]>({
    queryKey: ['active-visits-ecrf', patient.db_id],
    queryFn: () => coordinatorAPI.getActiveVisits(patient.db_id),
    enabled: !!patient.db_id,
  });

  const getStatusColor = (status: string) =>
    status === 'Checked In' || status === 'In Progress' ? '#16a34a' : '#6b7280';

  return (
    <div className="registry-container">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onBack} className="back-button" title="Back to Patient List">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="page-title">Select Visit</h1>
            <p className="text-gray-500 text-sm">
              Patient <strong>{patient.patient_id}</strong> — choose an active visit to enter data against.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="coord-spinner" style={{ width: '2rem', height: '2rem', borderWidth: '3px' }} />
          </div>
        ) : visits.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', textAlign: 'center' }}>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <AlertCircle size={28} color="#d97706" />
            </div>
            <h3 style={{ fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>No Active Visits</h3>
            <p style={{ color: '#6b7280', maxWidth: '360px', marginBottom: '1.5rem' }}>
              This patient has no checked-in visits. Schedule and check in a visit first.
            </p>
            <button onClick={onBack} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {visits.map((visit) => (
              <button key={visit.visit_instance_id} onClick={() => onSelectVisit(visit)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                  background: '#fafafa', cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: 'white', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={18} color="#4f46e5" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#111827', marginBottom: '0.2rem' }}>{visit.visit_name}</div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} />{new Date(visit.scheduled_date).toLocaleDateString()}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: '#f0fdf4', color: getStatusColor(visit.visit_status), border: `1px solid ${getStatusColor(visit.visit_status)}40` }}>
                        {visit.visit_status}
                      </span>
                    </div>
                  </div>
                </div>
                <CheckCircle size={16} color="#4f46e5" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Entry Mode Picker (Now with 3 columns!) ---
const EntryModePicker: React.FC<{
  patient: Patient;
  visit: ActiveVisit;
  onBack: () => void;
  onSelect: (mode: EntryMode) => void;
}> = ({ patient, visit, onBack, onSelect }) => (
  <div className="registry-container">
    <div className="section-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={onBack} className="back-button"><ArrowLeft size={24} /></button>
        <div>
          <h1 className="page-title">What would you like to enter?</h1>
          <p className="text-gray-500 text-sm">Patient <strong>{patient.patient_id}</strong> · {visit.visit_name}</p>
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', maxWidth: '900px' }}>
      {/* 1. Vitals Button */}
      <button onClick={() => onSelect('vitals')} style={{
        padding: '2rem', border: '1.5px solid #e5e7eb', borderRadius: '1rem', background: 'white',
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = '#f5f3ff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HeartPulse size={28} color="#4f46e5" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>Vital Signs</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>BP, Heart Rate, Temperature</div>
        </div>
      </button>

      {/* 2. Labs Button */}
      <button onClick={() => onSelect('labs')} style={{
        padding: '2rem', border: '1.5px solid #e5e7eb', borderRadius: '1rem', background: 'white',
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.background = '#f0fdfa'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TestTube size={28} color="#0d9488" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>Lab Results</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Blood, CBC, Chemistry, etc.</div>
        </div>
      </button>

      {/* 3. Adverse Event Button */}
      <button onClick={() => onSelect('ae')} style={{
        padding: '2rem', border: '1.5px solid #e5e7eb', borderRadius: '1rem', background: 'white',
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={28} color="#dc2626" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>Adverse Event</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Report new AE or SAE</div>
        </div>
      </button>
    </div>
  </div>
);

// --- Main Orchestrator Component ---
export const ECRFEntry: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<ActiveVisit | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);

  const resetToPatient = () => { setSelectedPatient(null); setSelectedVisit(null); setEntryMode(null); };
  const resetToVisit = () => { setSelectedVisit(null); setEntryMode(null); };
  const resetToMode = () => setEntryMode(null);

  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
        <PatientList onSelectPatient={(p) => { setSelectedPatient(p); setSelectedVisit(null); setEntryMode(null); }} />
      </div>
    );
  }

  if (!selectedVisit) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
        <VisitPicker patient={selectedPatient} onBack={resetToPatient} onSelectVisit={(v) => setSelectedVisit(v)} />
      </div>
    );
  }

  if (!entryMode) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
        <EntryModePicker patient={selectedPatient} visit={selectedVisit} onBack={resetToVisit} onSelect={(m) => setEntryMode(m)} />
      </div>
    );
  }

  if (entryMode === 'vitals') {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
        <ClinicalForm patient={selectedPatient} visitInstanceId={selectedVisit.visit_instance_id} visitName={selectedVisit.visit_name} onBack={resetToMode} />
      </div>
    );
  }

  if (entryMode === 'ae') {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
        <AEEntryForm patient={selectedPatient} visitInstanceId={selectedVisit.visit_instance_id} visitName={selectedVisit.visit_name} onBack={resetToMode} />
      </div>
    );
  }

  // Fallback to labs
  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
      <LabEntryForm patient={selectedPatient} visitInstanceId={selectedVisit.visit_instance_id} visitName={selectedVisit.visit_name} onBack={resetToMode} />
    </div>
  );
};
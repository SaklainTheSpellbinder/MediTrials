import React, { useState, useEffect } from 'react';
import { Search, FileText, ChevronRight, User } from 'lucide-react';
import { patientAPI } from '../../../services/api';
import '../../Principal_Investigator/PatientRegistry.css'; // Reusing the registry styles

// Shared Interface
export interface Patient {
  patient_id: string; // This will hold the trial_patient_id (e.g., PT-00123)
  initials: string;
  siteId: string;
  status: 'Screening' | 'Enrolled' | 'Completed' | 'Withdrawn';
  lastVisit: string;
  enrollmentDate: string;
  // We keep the internal DB id if needed for routing, spread it in if necessary, 
  // but for this UI interface, patient_id refers to the display ID.
  db_id?: number;
}

interface PatientListProps {
  onSelectPatient: (patient: Patient) => void;
}

export const PatientList: React.FC<PatientListProps> = ({ onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch Patients
  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoading(true);
        const data = await patientAPI.getAll();
        if (data.success && Array.isArray(data.patients)) {
          const formattedPatients: Patient[] = data.patients.map((p: any) => ({
            patient_id: p.trial_patient_id,
            db_id: p.patient_id,
            initials: p.full_name ? p.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'XX',
            siteId: p.institution_name || 'Site ' + p.site_id,
            status: mapStatus(p.patient_status),
            lastVisit: 'N/A', // Not currently fetched
            enrollmentDate: p.enrollment_date ? new Date(p.enrollment_date).toLocaleDateString() : 'N/A'
          }));
          setPatients(formattedPatients);
        }
      } catch (error) {
        console.error("Failed to load patients", error);
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  // Helper to map DB status to UI status
  const mapStatus = (dbStatus: string): Patient['status'] => {
    if (!dbStatus) return 'Screening';
    const lower = dbStatus.toLowerCase();
    if (lower.includes('screen') || lower.includes('pending')) return 'Screening';
    if (lower.includes('active') || lower.includes('enrolled') || lower.includes('treatment')) return 'Enrolled';
    if (lower.includes('complete')) return 'Completed';
    if (lower.includes('withdraw')) return 'Withdrawn';
    return 'Screening'; // Default fallback
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Enrolled': return 'success';
      case 'Completed': return 'primary';
      case 'Withdrawn': return 'danger';
      case 'Screening': return 'warning';
      default: return 'gray';
    }
  };

  const filteredPatients = patients.filter((patient) => {
    const term = searchTerm.toLowerCase();
    return (
      patient.patient_id.toLowerCase().includes(term) ||
      patient.initials.toLowerCase().includes(term) ||
      patient.siteId.toLowerCase().includes(term) ||
      patient.status.toLowerCase().includes(term)
    );
  });

  return (
    <div className="registry-container">
      {/* Header Section */}
      <div className="section-header">
        <div>
          <h1 className="page-title">eCRF Data Entry</h1>
          <p className="text-gray-500 text-sm">Select a subject from the list below to enter visit data.</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">

        {/* Toolbar (Gray Bar) */}
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by Patient ID or Site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="text-sm text-gray-500">
            Showing <strong>{filteredPatients.length}</strong> available subjects
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Initials</th>
                <th>Site</th>
                <th>Status</th>
                <th>Last Visit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">Loading patients...</td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">No patients found matching "{searchTerm}"</td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.patient_id}>
                    <td className="font-mono font-medium">
                      {patient.patient_id}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <User size={12} />
                        </div>
                        {patient.initials}
                      </div>
                    </td>
                    <td>{patient.siteId}</td>
                    <td>
                      <span className={`status-badge status-${getStatusColor(patient.status)}`}>
                        {patient.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{patient.lastVisit}</td>
                    <td>
                      <button
                        onClick={() => onSelectPatient(patient)}
                        className="btn-secondary flex items-center gap-2 text-xs py-1 px-3"
                      >
                        <FileText size={14} /> Enter Data <ChevronRight size={14} className="text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="table-footer">
          <p className="text-sm text-gray-500">
            {loading ? 'Checking records...' : `Total ${patients.length} records`}
          </p>
          <div className="pagination">
            <button disabled>Previous</button>
            <button className="active">1</button>
            <button disabled>Next</button>
          </div>
        </div>

      </div>
    </div>
  );
};
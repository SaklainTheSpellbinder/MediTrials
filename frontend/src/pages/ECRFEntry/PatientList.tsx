import React, { useState } from 'react';
import { Search, FileText, ChevronRight, User } from 'lucide-react';
// Make sure this points to the CSS file you shared with me
import '.././PatientRegistry.css';

// Shared Interface
export interface Patient {
  patient_id: string;  // Changed from id to patient_id
  initials: string;
  siteId: string;
  status: 'Screening' | 'Enrolled' | 'Completed' | 'Withdrawn';
  lastVisit: string;
  enrollmentDate: string;
}

interface PatientListProps {
  onSelectPatient: (patient: Patient) => void;
}

// Mock Data
const MOCK_PATIENTS: Patient[] = [
  { patient_id: 'MT-001-102', initials: 'JD', siteId: 'Site 101', status: 'Enrolled', lastVisit: '2024-01-15', enrollmentDate: '2024-01-10' },
  { patient_id: 'MT-001-105', initials: 'AS', siteId: 'Site 101', status: 'Screening', lastVisit: '2024-02-01', enrollmentDate: '2024-01-16' },
  { patient_id: 'MT-002-204', initials: 'RK', siteId: 'Site 203', status: 'Enrolled', lastVisit: '2024-01-20', enrollmentDate: '2024-01-09' },
  { patient_id: 'MT-003-301', initials: 'ML', siteId: 'Site 102', status: 'Completed', lastVisit: '2023-12-10', enrollmentDate: '2023-11-05' },
];

export const PatientList: React.FC<PatientListProps> = ({ onSelectPatient }) => {

  // Helper to match your CSS classes for status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Enrolled': return 'success';   // active/enrolled -> green
      case 'Completed': return 'primary';  // completed -> blue
      case 'Withdrawn': return 'danger';   // withdrawn -> red
      case 'Screening': return 'warning';  // screening -> yellow/orange
      default: return 'gray';
    }
  };

  // 1. STATE: Tracks what is typed
  const [searchTerm, setSearchTerm] = useState('');

  // 2. FILTER LOGIC: Updates the list automatically when searchTerm changes
  // Note: Replace 'MOCK_PATIENTS' with 'patients' if you are fetching real data
  const filteredPatients = MOCK_PATIENTS.filter((patient) => {
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
              className="...your classes..."
              // ADD THESE TWO LINES:
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
              {filteredPatients.map((patient) => (
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
                    {/* Action Button styled to fit the table */}
                    <button
                      onClick={() => onSelectPatient(patient)}
                      className="btn-secondary flex items-center gap-2 text-xs py-1 px-3"
                    >
                      <FileText size={14} /> Enter Data <ChevronRight size={14} className="text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPatients.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No patients found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="table-footer">
          <p className="text-sm text-gray-500">Page 1 of 1</p>
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
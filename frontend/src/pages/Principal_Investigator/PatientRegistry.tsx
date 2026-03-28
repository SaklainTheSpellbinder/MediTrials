import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, MoreHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { patientAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './PatientRegistry.css';

interface Patient {
    patient_id: number;
    trial_patient_id: string;
    full_name?: string;
    date_of_birth: string;
    gender: string;
    patient_status: string;
    enrollment_date: string | null;
    institution_name?: string;
}

export const PatientRegistry: React.FC = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Registration modal state
    const [showModal, setShowModal] = useState(false);
    const [regForm, setRegForm] = useState({ full_name: '', date_of_birth: '', gender: 'Male' });
    const [regSubmitting, setRegSubmitting] = useState(false);
    const [regError, setRegError] = useState<string | null>(null);

    useEffect(() => { fetchPatients(); }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await patientAPI.getAll();
            if (data.success && Array.isArray(data.patients)) {
                setPatients(data.patients);
            } else {
                setPatients([]);
            }
        } catch (err: any) {
            console.error('Error fetching patients:', err);
            setError('Failed to load patients from server.');
            setPatients([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            p.trial_patient_id?.toLowerCase().includes(term) ||
            p.full_name?.toLowerCase().includes(term) ||
            p.institution_name?.toLowerCase().includes(term) ||
            p.patient_status?.toLowerCase().includes(term)
        );
    });

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'active treatment': return 'success';
            case 'completed': return 'primary';
            case 'screen failure': case 'withdrawn': case 'lost to follow-up': return 'danger';
            case 'enrolled': return 'warning';
            case 'screened': return 'gray';
            default: return 'gray';
        }
    };

    const calculateAge = (dob: string) => {
        try {
            const d = new Date(dob), t = new Date();
            let age = t.getFullYear() - d.getFullYear();
            const m = t.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
            return age;
        } catch { return 'N/A'; }
    };

    const formatDate = (ds: string) => {
        try {
            return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch { return ds; }
    };

    const handleExport = () => {
        const csvContent = [
            ['Patient ID', 'Age', 'Gender', 'Site', 'Status', 'Enrollment Date'],
            ...patients.map(p => [
                p.trial_patient_id, calculateAge(p.date_of_birth), p.gender,
                p.institution_name || 'N/A', p.patient_status, p.enrollment_date ? formatDate(p.enrollment_date) : ''
            ])
        ].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'patients.csv'; a.click();
    };

    // ── Registration Modal Submit ────────────────────────────────────
    const handleRegister = async () => {
        if (!regForm.date_of_birth || !regForm.gender) return;
        setRegSubmitting(true);
        setRegError(null);
        try {
            await patientAPI.create({
                full_name: regForm.full_name || undefined,
                date_of_birth: regForm.date_of_birth,
                gender: regForm.gender,
                site_id: user?.site_id ?? 1,
            });
            setShowModal(false);
            setRegForm({ full_name: '', date_of_birth: '', gender: 'Male' });
            fetchPatients();
        } catch (err: any) {
            setRegError(err?.response?.data?.error || 'Registration failed.');
        } finally {
            setRegSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="registry-container">
                <div className="section-header"><h1 className="page-title">Patient Registry</h1></div>
                <div className="card text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
                    <p className="mt-4 text-gray-600">Loading patients from database...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="registry-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Patient Registry</h1>
                    <p className="text-gray-500 text-sm">
                        {error ? <span className="text-amber-600">⚠️ {error}</span> : `Total Patients: ${patients.length}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                        <Download size={16} /> Export CSV
                    </button>
                    <button onClick={fetchPatients} className="btn-secondary flex items-center gap-2">
                        <Search size={16} /> Refresh
                    </button>
                    <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
                        <Plus size={16} /> Register Patient
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text" placeholder="Search by ID, site, or status..."
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn-secondary flex items-center gap-2"><Filter size={16} /> Filters</button>
                </div>

                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Name</th>
                                <th>Age/Gender</th>
                                <th>Site</th>
                                <th>Status</th>
                                <th>Enrollment Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((patient) => (
                                <tr key={patient.patient_id}>
                                    <td className="font-mono font-medium">{patient.trial_patient_id}</td>
                                    <td>{patient.full_name || '—'}</td>
                                    <td>{calculateAge(patient.date_of_birth)} / {patient.gender}</td>
                                    <td>{patient.institution_name || 'N/A'}</td>
                                    <td>
                                        <span className={`status-badge status-${getStatusColor(patient.patient_status)}`}>
                                            {patient.patient_status}
                                        </span>
                                    </td>
                                    <td>{patient.enrollment_date ? formatDate(patient.enrollment_date) : '—'}</td>
                                    <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {patient.patient_status === 'Screened' && !patient.enrollment_date && (
                                            <Link
                                                to={`/patients/screening/${patient.patient_id}`}
                                                className="btn-secondary"
                                                title="PI review / enrollment"
                                                style={{ padding: '4px 8px', fontSize: '0.70rem' }}
                                            >
                                                Review
                                            </Link>
                                        )}
                                        <Link to={`/patients/${patient.patient_id}`} className="btn-icon" title="View Details">
                                            <MoreHorizontal size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="table-footer">
                    <p>Showing {filteredPatients.length} of {patients.length} patients</p>
                    <div className="pagination">
                        <button disabled>Previous</button>
                        <button className="active">1</button>
                        <button>2</button>
                        <button>Next</button>
                    </div>
                </div>
            </div>

            {/* ── Registration Modal ──────────────────────────────────── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h2>Register New Patient</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginBottom: 16 }}>
                                A trial patient ID will be auto-generated. After registration, open the patient profile to record informed consent and complete the eligibility checklist.
                            </p>
                            {regError && <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: '0.82rem', marginBottom: 12 }}>{regError}</div>}
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Full Name</label>
                                <input
                                    type="text" className="form-input"
                                    placeholder="e.g. John Doe"
                                    value={regForm.full_name}
                                    onChange={e => setRegForm(f => ({ ...f, full_name: e.target.value }))}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Date of Birth <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                                    <input
                                        type="date" className="form-input"
                                        max={new Date().toISOString().split('T')[0]}
                                        value={regForm.date_of_birth}
                                        onChange={e => setRegForm(f => ({ ...f, date_of_birth: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Gender <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                                    <select
                                        className="form-select"
                                        value={regForm.gender}
                                        onChange={e => setRegForm(f => ({ ...f, gender: e.target.value }))}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other / Prefer not to say</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button
                                className="btn-primary"
                                disabled={!regForm.date_of_birth || regSubmitting}
                                onClick={handleRegister}
                            >
                                {regSubmitting ? 'Registering…' : 'Register'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
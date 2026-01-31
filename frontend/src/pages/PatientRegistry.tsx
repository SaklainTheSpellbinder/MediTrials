import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { patientAPI } from '../services/api';
import './PatientRegistry.css';

interface Patient {
    id: number;              // Database Primary Key
    trial_patient_id: string; // The "Readable" ID (e.g., PT-001)
    date_of_birth: string;
    gender: string;
    patient_status: string;
    enrollment_date: string;
    institution_name?: string;
}

export const PatientRegistry: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch patients from backend on component mount
    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // CORRECTION 2: Handle the specific response structure { success: true, patients: [] }
            const data = await patientAPI.getAll();
            
            if (data.success && Array.isArray(data.patients)) {
                setPatients(data.patients);
            } else {
                // Fallback if data format is unexpected
                setPatients([]); 
            }
        } catch (err: any) {
            console.error('Error fetching patients:', err);
            setError('Failed to load patients from server. Using sample data.');
            setPatients(getSamplePatients());
        } finally {
            setLoading(false);
        }
    };

    // CORRECTION 3: Updated sample data to match new Interface (id)
    const getSamplePatients = (): Patient[] => [
        { id: 1, trial_patient_id: 'PT-00123', date_of_birth: '1979-03-15', gender: 'M', patient_status: 'Active', enrollment_date: '2024-01-10', institution_name: 'Site 101' },
        { id: 2, trial_patient_id: 'PT-00124', date_of_birth: '1992-07-22', gender: 'F', patient_status: 'Completed', enrollment_date: '2024-01-05', institution_name: 'Site 101' },
        { id: 3, trial_patient_id: 'PT-00125', date_of_birth: '1966-11-05', gender: 'M', patient_status: 'Active', enrollment_date: '2024-01-09', institution_name: 'Site 203' },
        { id: 4, trial_patient_id: 'PT-00126', date_of_birth: '1983-09-30', gender: 'F', patient_status: 'Withdrawn', enrollment_date: '2023-12-15', institution_name: 'Site 101' },
        { id: 5, trial_patient_id: 'PT-00127', date_of_birth: '1957-12-14', gender: 'M', patient_status: 'Active', enrollment_date: '2024-01-12', institution_name: 'Site 203' },
        { id: 6, trial_patient_id: 'PT-00128', date_of_birth: '1995-01-17', gender: 'F', patient_status: 'Screening', enrollment_date: '2024-01-16', institution_name: 'Site 102' },
    ];

    const filteredPatients = patients.filter(p => {
    const term = searchTerm.toLowerCase();
    
    // safe access: use optional chaining (?) and fallback to empty string ('')
    const idMatch = p.trial_patient_id?.toLowerCase().includes(term) || false;
    const siteMatch = p.institution_name?.toLowerCase().includes(term) || false;
    const statusMatch = p.patient_status?.toLowerCase().includes(term) || false;

    return idMatch || siteMatch || statusMatch;
});

    const getStatusColor = (status: string) => {
        // Safe check in case status is null/undefined from DB
        const safeStatus = status ? status.toLowerCase() : '';
        switch (safeStatus) {
            case 'active treatment': return 'success';
            case 'completed': return 'primary';
            case 'screen failure': return 'danger';
            case 'enrolled': return 'warning';
            case 'withdrawn': return 'danger';
            case 'lost to follow-up': return 'danger';
            default: return 'gray';
        }
    };

    // Calculate age from date of birth
    const calculateAge = (dateOfBirth: string) => {
        try {
            const dob = new Date(dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                age--;
            }
            return age;
        } catch {
            return 'N/A';
        }
    };

    // Format date
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Handle refresh
    const handleRefresh = () => {
        fetchPatients();
    };

    // Handle export
    const handleExport = () => {
        const csvContent = [
            ['Patient ID', 'Age', 'Gender', 'Site', 'Status', 'Enrollment Date'],
            ...patients.map(p => [
                p.trial_patient_id,
                calculateAge(p.date_of_birth),
                p.gender,
                p.institution_name || 'N/A',
                p.patient_status,
                formatDate(p.enrollment_date)
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'patients.csv';
        a.click();
    };

    if (loading) {
        return (
            <div className="registry-container">
                <div className="section-header">
                    <h1 className="page-title">Patient Registry</h1>
                </div>
                <div className="card text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
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
                        {error ? (
                            <span className="text-amber-600">⚠️ {error}</span>
                        ) : (
                            /* CORRECTION 4: Check p.id > 6 to detect live DB data */
                            `Total Patients: ${patients.length} (${patients.length > 0 && patients[0].id > 6 ? 'Live Database' : 'Sample Data'})`
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExport}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                    <button 
                        onClick={handleRefresh}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Search size={16} /> Refresh
                    </button>
                    <button className="btn-primary flex items-center gap-2">
                        <Plus size={16} /> New Patient
                    </button>
                </div>
            </div>

            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by ID, site, or status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button className="btn-secondary flex items-center gap-2">
                        <Filter size={16} /> Filters
                    </button>
                </div>

                {/* Table */}
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Age/Gender</th>
                                <th>Site</th>
                                <th>Status</th>
                                <th>Enrollment Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((patient) => (
                                /* CORRECTION 5: Use patient.id for key */
                                <tr key={patient.id}>
                                    <td className="font-mono font-medium">
                                        {patient.trial_patient_id}
                                    </td>
                                    <td>
                                        {calculateAge(patient.date_of_birth)} / {patient.gender}
                                    </td>
                                    <td>{patient.institution_name || 'N/A'}</td>
                                    <td>
                                        <span className={`status-badge status-${getStatusColor(patient.patient_status)}`}>
                                            {patient.patient_status}
                                        </span>
                                    </td>
                                    <td>{formatDate(patient.enrollment_date)}</td>
                                    <td>
                                        {/* CORRECTION 6: Link uses patient.id */}
                                        <Link 
                                            to={`/patients/${patient.id}`} 
                                            className="btn-icon"
                                            title="View Details"
                                        >
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
        </div>
    );
};
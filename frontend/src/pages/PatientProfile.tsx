import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    FileText,
    Clock,
    Clipboard,
    Calendar,
    AlertCircle,
    User,
    Heart,
    Weight,
    Ruler
} from 'lucide-react';
import { patientAPI, visitAPI, labAPI } from '../services/api'; // Add this import
import './PatientProfile.css';

interface Patient {
  patient_id: number;
  trial_patient_id: string;
  date_of_birth: string;
  gender: string;
  patient_status: string;
  enrollment_date: string;
  institution_name?: string;
  medical_history_summary?: any;
  site_id?: number;
}

export const PatientProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState('timeline');
    const [patient, setPatient] = useState<Patient | null>(null);
    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState<any[]>([]);
    const [labs, setLabs] = useState<any[]>([]);

    // Fetch patient data on component mount
    useEffect(() => {
        if (id) {
            fetchPatientData();
        }
    }, [id]);

    const fetchPatientData = async () => {
        try {
            setLoading(true);
            
            // Fetch patient details from backend
            const patientData = await patientAPI.getById(parseInt(id!));
            setPatient(patientData.patient || getSamplePatient());
            
           // You can uncomment these when you create visit and lab endpoints
            // try {
            //     const visitsData = await visitAPI.getByPatientId(parseInt(id!));
            //     setVisits(visitsData.visits || []);
            // } catch (err) {
            //     console.log('Visit data not available yet');
            // }
            
            // try {
            //     const labsData = await labAPI.getByPatientId(parseInt(id!));
            //     setLabs(labsData.labResults || []);
            // } catch (err) {
            //     console.log('Lab data not available yet');
            // }
            
        } catch (error) {
            console.error('Error fetching patient data:', error);
            // Fallback to sample data
            setPatient(getSamplePatient());
        } finally {
            setLoading(false);
        }
    };

    // Sample data fallback
    const getSamplePatient = (): Patient => ({
        patient_id: parseInt(id || '1'),
        trial_patient_id: id || 'PT-00123',
        date_of_birth: '1979-05-12',
        gender: 'M',
        patient_status: 'Active',
        enrollment_date: '2023-11-15',
        institution_name: 'Site 101',
        medical_history_summary: { conditions: ['Hypertension', 'Hyperlipidemia'] },
        site_id: 101
    });

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
            return 45; // Default age
        }
    };

    // Format date nicely
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

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    // Get status badge class
    const getStatusClass = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'badge-success';
            case 'completed': return 'badge-primary';
            case 'withdrawn': return 'badge-danger';
            case 'screening': return 'badge-warning';
            default: return 'badge-gray';
        }
    };

    // Get patient name from trial ID (in real app, you'd have actual names)
    const getPatientName = (patientId: string) => {
        const names: Record<string, string> = {
            'PT-00123': 'John Doe',
            'PT-00124': 'Jane Smith',
            'PT-00125': 'Bob Johnson',
            'PT-00126': 'Alice Brown',
            'PT-00127': 'Charlie White',
            'PT-00128': 'Diana Prince',
        };
        return names[patientId] || `Patient ${patientId}`;
    };

    if (loading) {
        return (
            <div className="profile-container">
                <div className="patient-header card">
                    <div className="ph-main">
                        <div className="ph-avatar animate-pulse bg-gray-200"></div>
                        <div>
                            <h1 className="ph-name">
                                <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
                            </h1>
                            <div className="ph-meta">
                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading patient data...</p>
                </div>
            </div>
        );
    }

    const currentPatient = patient || getSamplePatient();
    const patientName = getPatientName(currentPatient.trial_patient_id);
    const patientAge = calculateAge(currentPatient.date_of_birth);

    return (
        <div className="profile-container">
            {/* Patient Header */}
            <div className="patient-header card">
                <div className="ph-main">
                    <div className="ph-avatar bg-blue-500 text-white">
                        {getInitials(patientName)}
                    </div>
                    <div>
                        <h1 className="ph-name">
                            {patientName} 
                            <span className="text-gray-500 font-normal">
                                ({patientAge}/{currentPatient.gender})
                            </span>
                        </h1>
                        <div className="ph-meta">
                            <span className="font-mono text-primary">{currentPatient.trial_patient_id}</span>
                            <span className="divider">•</span>
                            <span>Site: {currentPatient.site_id || '101'}</span>
                            <span className="divider">•</span>
                            <span className={getStatusClass(currentPatient.patient_status)}>
                                {currentPatient.patient_status}
                            </span>
                            {patient && patient.patient_id && patient.patient_id > 6 && (
                                <>
                                <span className="divider">•</span>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                    Live Data
                                </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="ph-actions">
                    <button className="btn-secondary flex items-center gap-2">
                        <Calendar size={16} /> Schedule Visit
                    </button>
                    <button className="btn-secondary text-danger border-danger flex items-center gap-2">
                        <AlertCircle size={16} /> Report AE
                    </button>
                    <button className="btn-primary flex items-center gap-2">
                        <FileText size={16} /> View eCRF
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="profile-tabs">
                {[
                    { id: 'timeline', label: 'Timeline', icon: Clock },
                    { id: 'clinical', label: 'Clinical Data', icon: Activity },
                    { id: 'safety', label: 'Safety', icon: AlertTriangle },
                    { id: 'labs', label: 'Lab Results', icon: FileText },
                    { id: 'docs', label: 'Documents', icon: Clipboard },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="profile-content">
                <div className="content-main">
                    {/* Timeline View */}
                    {activeTab === 'timeline' && (
                        <div className="timeline-list">
                            {/* Visit 3 - Most Recent */}
                            <div className="timeline-item">
                                <div className="tl-date">
                                    <span className="day">15</span>
                                    <span className="month">Jan</span>
                                    <span className="year">2024</span>
                                </div>
                                <div className="tl-line"></div>
                                <div className="tl-content card">
                                    <div className="tl-header">
                                        <h3>Visit 3: Completed</h3>
                                        <span className="time">09:30 AM</span>
                                    </div>
                                    <div className="tl-body">
                                        <ul>
                                            <li>
                                                <Activity size={14} className="inline mr-2 text-success" /> 
                                                Vitals collected: BP 120/80
                                            </li>
                                            <li>
                                                <FileText size={14} className="inline mr-2 text-primary" /> 
                                                Labs drawn: Chem-7, CBC
                                            </li>
                                            <li>
                                                <AlertTriangle size={14} className="inline mr-2 text-warning" /> 
                                                AE Reported: Mild Headache (Grade 1)
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="tl-footer">
                                        <button className="btn-xs">View Visit Data</button>
                                    </div>
                                </div>
                            </div>

                            {/* Visit 2 */}
                            <div className="timeline-item">
                                <div className="tl-date">
                                    <span className="day">10</span>
                                    <span className="month">Dec</span>
                                    <span className="year">2023</span>
                                </div>
                                <div className="tl-line"></div>
                                <div className="tl-content card">
                                    <div className="tl-header">
                                        <h3>Visit 2: Follow-up</h3>
                                        <span className="time">10:00 AM</span>
                                    </div>
                                    <div className="tl-body">
                                        <p>Routine follow-up. No adverse events reported. Study drug dispensed.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Visit 1 - Randomization */}
                            <div className="timeline-item">
                                <div className="tl-date">
                                    <span className="day">15</span>
                                    <span className="month">Nov</span>
                                    <span className="year">2023</span>
                                </div>
                                <div className="tl-line"></div>
                                <div className="tl-content card">
                                    <div className="tl-header">
                                        <h3>Visit 1: Randomization & Enrollment</h3>
                                        <span className="time">14:15 PM</span>
                                    </div>
                                    <div className="tl-body">
                                        <p>
                                            Patient enrolled on <strong>{formatDate(currentPatient.enrollment_date)}</strong>.
                                            {currentPatient.patient_id && currentPatient.patient_id <= 6 ? (
                                                ' Randomized to Arm B (Placebo).'
                                            ) : (
                                                ` Patient ID ${currentPatient.trial_patient_id} loaded from database.`
                                            )}
                                        </p>
                                        {currentPatient.medical_history_summary && (
                                            <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                                                <strong>Medical History:</strong>{' '}
                                                {JSON.stringify(currentPatient.medical_history_summary)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Database Info Card */}
                            {patient && patient.patient_id && patient.patient_id > 6 && (
                                <div className="timeline-item">
                                    <div className="tl-date">
                                        <span className="day">
                                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-xs">✓</span>
                                            </div>
                                        </span>
                                    </div>
                                    <div className="tl-line"></div>
                                    <div className="tl-content card border-green-200 bg-green-50">
                                        <div className="tl-header">
                                            <h3 className="text-green-700">Connected to Database</h3>
                                            <span className="time">Live</span>
                                        </div>
                                        <div className="tl-body">
                                            <p className="text-green-600">
                                                Patient data loaded from PostgreSQL database.
                                                Real-time updates available when backend endpoints are complete.
                                            </p>
                                            <div className="mt-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span>Patient ID: {currentPatient.patient_id}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span>Site: {currentPatient.institution_name || `Site ${currentPatient.site_id}`}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Clinical Data Tab */}
                    {activeTab === 'clinical' && (
                        <div className="card p-6">
                            <h3 className="text-lg font-bold mb-4">Clinical Data</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">Vital Signs</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <span className="text-gray-600">Blood Pressure</span>
                                            <span className="font-medium">120/80 mmHg</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <span className="text-gray-600">Heart Rate</span>
                                            <span className="font-medium">72 bpm</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <span className="text-gray-600">Temperature</span>
                                            <span className="font-medium">36.8°C</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">Physical Exam</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <span className="text-gray-600">Height</span>
                                            <span className="font-medium">178 cm</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <span className="text-gray-600">Weight</span>
                                            <span className="font-medium">82 kg</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                            <span className="text-gray-600">BMI</span>
                                            <span className="font-medium">25.8</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Other Tabs */}
                    {activeTab !== 'timeline' && activeTab !== 'clinical' && (
                        <div className="card p-6 text-center">
                            <div className="py-8">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                                    {activeTab === 'safety' && <AlertTriangle size={24} className="text-blue-500" />}
                                    {activeTab === 'labs' && <FileText size={24} className="text-blue-500" />}
                                    {activeTab === 'docs' && <Clipboard size={24} className="text-blue-500" />}
                                </div>
                                <h3 className="text-lg font-bold mb-2">
                                    {activeTab === 'safety' && 'Safety Monitoring'}
                                    {activeTab === 'labs' && 'Laboratory Results'}
                                    {activeTab === 'docs' && 'Documents'}
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    {patient && patient.patient_id && patient.patient_id > 6 ? (
                                        'This module will display real data when backend endpoints are completed.'
                                    ) : (
                                        'Sample data will be replaced with real data from database.'
                                    )}
                                </p>
                                <button 
                                    className="btn-secondary"
                                    onClick={fetchPatientData}
                                >
                                    Refresh Data
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="content-sidebar">
                    <div className="card p-4 mb-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <User size={14} /> Demographics
                        </h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Date of Birth</label>
                                <span>{currentPatient.date_of_birth}</span>
                            </div>
                            <div className="info-item">
                                <label>Age</label>
                                <span>{patientAge} years</span>
                            </div>
                            <div className="info-item">
                                <label>Gender</label>
                                <span>{currentPatient.gender}</span>
                            </div>
                            <div className="info-item">
                                <label>Enrollment Date</label>
                                <span>{formatDate(currentPatient.enrollment_date)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card p-4 mb-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <Ruler size={14} /> Measurements
                        </h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Height</label>
                                <span>178 cm</span>
                            </div>
                            <div className="info-item">
                                <label>Weight</label>
                                <span>82 kg</span>
                            </div>
                            <div className="info-item">
                                <label>BMI</label>
                                <span>25.8</span>
                            </div>
                        </div>
                    </div>

                    <div className="card p-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <Heart size={14} /> Current Medications
                        </h4>
                        <ul className="text-sm space-y-2">
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Lisinopril 10mg (for Hypertension)
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Atorvastatin 20mg (for Cholesterol)
                            </li>
                            {currentPatient.medical_history_summary?.conditions?.includes('Type 2 Diabetes') && (
                                <li className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    Metformin 1000mg (for Diabetes)
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Activity,
    FileText,
    Clock,
    Clipboard,
    Calendar,
    AlertCircle,
    PenTool,
    AlertTriangle,
    User,
    Heart,
    Ruler,
    CheckCircle
} from 'lucide-react';
import { patientProfileAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
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
    const { user } = useAuth();
    const { patient_id } = useParams<{ patient_id: string }>();
    const [activeTab, setActiveTab] = useState('timeline');
    const [patient, setPatient] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [clinical, setClinical] = useState<any>({ visits: [], vitals: [], history: [] });
    const [safety, setSafety] = useState<any>({ adverseEvents: [], alerts: [], protocolDeviations: [] });
    const [labs, setLabs] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any>({ consent: [], ecrfs: [], auditTrail: [] });
    const [loading, setLoading] = useState(true);

    // Fetch patient data on component mount
    useEffect(() => {
        if (patient_id) {
            fetchPatientData();
        }
    }, [patient_id]);

    const fetchPatientData = async () => {
        try {
            setLoading(true);
            if (!patient_id) return;
            const pid = parseInt(patient_id);

            // Fetch patient details from backend API endpoints
            try {
                const headerData = await patientProfileAPI.getHeader(pid);
                setPatient(headerData.profile || getSamplePatient());
            } catch (err) {
                console.error('Error fetching header:', err);
                setPatient(getSamplePatient());
            }

            try {
                const timelineData = await patientProfileAPI.getTimeline(pid);
                if (timelineData.timeline) setTimeline(timelineData.timeline);
            } catch (err) { console.log('Timeline missing'); }

            try {
                const clinicalData = await patientProfileAPI.getClinical(pid);
                if (clinicalData.clinical) setClinical(clinicalData.clinical);
            } catch (err) { console.log('Clinical missing'); }

            try {
                const safetyData = await patientProfileAPI.getSafety(pid);
                if (safetyData.safety) setSafety(safetyData.safety);
            } catch (err) { console.log('Safety missing'); }

            try {
                const labsData = await patientProfileAPI.getLabs(pid);
                if (labsData.labs) setLabs(labsData.labs);
            } catch (err) { console.log('Labs missing'); }

            try {
                const docsData = await patientProfileAPI.getDocuments(pid);
                if (docsData.documents) setDocuments(docsData.documents);
            } catch (err) { console.log('Documents missing'); }

        } catch (error) {
            console.error('Error fetching patient data:', error);
            setPatient(getSamplePatient());
        } finally {
            setLoading(false);
        }
    };

    // Sample data fallback
    const getSamplePatient = (): Patient => ({
        patient_id: parseInt(patient_id || '1'),
        trial_patient_id: patient_id || 'PT-00123',
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

                    {/* Role-Based Actions */}
                    {user?.role === 'Principal_Investigator' ? (
                        <button className="btn-primary flex items-center gap-2">
                            <PenTool size={16} /> Sign eCRF
                        </button>
                    ) : (
                        <button className="btn-primary flex items-center gap-2">
                            <Activity size={16} /> Enter Vitals
                        </button>
                    )}

                    <button className="btn-secondary text-danger border-danger flex items-center gap-2">
                        <AlertCircle size={16} /> Report AE
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
                            {timeline.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No timeline events found.</p>
                            ) : (
                                timeline.map((event: any, index: number) => {
                                    const eventDate = new Date(event.event_date);
                                    return (
                                        <div key={index} className="timeline-item">
                                            <div className="tl-date">
                                                <span className="day">{eventDate.getDate()}</span>
                                                <span className="month">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                <span className="year">{eventDate.getFullYear()}</span>
                                            </div>
                                            <div className="tl-line"></div>
                                            <div className={`tl-content card ${event.event_type === 'Critical Lab' ? 'border-red-200 bg-red-50' : ''}`}>
                                                <div className="tl-header">
                                                    <h3 className={event.event_type === 'Critical Lab' ? 'text-red-700' : ''}>
                                                        {event.event_type}
                                                    </h3>
                                                    <span className="time">{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className="tl-body">
                                                    <p>{event.description}</p>

                                                    {event.event_type === 'Adverse Event' && event.result_value && (
                                                        <div className="mt-2 text-sm text-amber-700">
                                                            <AlertTriangle size={14} className="inline mr-2" />
                                                            Grade: {event.result_value}
                                                        </div>
                                                    )}
                                                    {event.event_type === 'Critical Lab' && event.result_value && (
                                                        <div className="mt-2 text-sm font-bold text-red-600">
                                                            Result Value: {event.result_value}
                                                        </div>
                                                    )}
                                                </div>
                                                {event.visit_instance_id && (
                                                    <div className="tl-footer">
                                                        <button className="btn-xs">View Visit Data</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Clinical Data Tab */}
                    {activeTab === 'clinical' && (
                        <div className="card p-6">
                            <h3 className="text-lg font-bold mb-4">Clinical Data</h3>

                            {/* Visit Schedule Table */}
                            <div className="mb-8">
                                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <Calendar size={16} /> Visit Schedule
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-4 py-3">Visit Name</th>
                                                <th scope="col" className="px-4 py-3">Scheduled Date</th>
                                                <th scope="col" className="px-4 py-3">Actual Date</th>
                                                <th scope="col" className="px-4 py-3">Status</th>
                                                <th scope="col" className="px-4 py-3">Window Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clinical.visits?.length > 0 ? (
                                                clinical.visits.map((v: any, idx: number) => (
                                                    <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                        <td className="px-4 py-3 font-medium text-gray-900">{v.visit_name}</td>
                                                        <td className="px-4 py-3">{formatDate(v.scheduled_date)}</td>
                                                        <td className="px-4 py-3">{v.actual_visit_date ? formatDate(v.actual_visit_date) : '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.visit_status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                                    v.visit_status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {v.visit_status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">{v.visit_window_status || '-'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={5} className="px-4 py-4 text-center">No visits found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Vitals Data */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <Activity size={16} /> Recent Vital Signs
                                    </h4>
                                    {clinical.vitals?.length > 0 ? (
                                        clinical.vitals.slice(0, 3).map((v: any, idx: number) => (
                                            <div key={idx} className="mb-4 space-y-2 border border-gray-100 rounded-lg p-3 bg-white">
                                                <div className="text-xs text-gray-400 font-mono mb-2">
                                                    {new Date(v.measurement_time).toLocaleString()}
                                                </div>
                                                <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                    <span className="text-gray-600 text-sm">Blood Pressure</span>
                                                    <span className="font-medium text-sm">{v.systolic_bp}/{v.diastolic_bp} mmHg</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                    <span className="text-gray-600 text-sm">Heart Rate</span>
                                                    <span className="font-medium text-sm">{v.heart_rate} bpm</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                    <span className="text-gray-600 text-sm">Temperature</span>
                                                    <span className="font-medium text-sm">{v.temperature}°C</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No vitals recorded.</p>
                                    )}
                                </div>

                                {/* Medical History Data */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <Clipboard size={16} /> Medical History List
                                    </h4>
                                    <div className="space-y-3">
                                        {clinical.history?.length > 0 ? (
                                            clinical.history.map((h: any, idx: number) => (
                                                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-start">
                                                    <div>
                                                        <h5 className="font-medium text-gray-800">{h.condition_name}</h5>
                                                        {h.notes && <p className="text-xs text-gray-500 mt-1">{h.notes}</p>}
                                                        <div className="text-xs text-gray-400 mt-2">
                                                            Diagnosed: {h.diagnosis_date ? formatDate(h.diagnosis_date) : 'Unknown'}
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${h.is_active ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-700'}`}>
                                                        {h.is_active ? 'Active' : 'Resolved'}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No medical history on file.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Safety Tab */}
                    {activeTab === 'safety' && (
                        <div className="card p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-danger">
                                <AlertTriangle size={20} /> Safety Monitoring
                            </h3>
                            
                            {/* Adverse Events */}
                            <div className="mb-8">
                                <h4 className="font-medium text-gray-700 mb-3">Adverse Events</h4>
                                <div className="space-y-3">
                                    {safety.adverseEvents?.length > 0 ? (
                                        safety.adverseEvents.map((ae: any, idx: number) => (
                                            <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-100 flex justify-between items-start">
                                                <div>
                                                    <h5 className="font-medium text-red-900">{ae.ae_term}</h5>
                                                    <p className="text-xs text-red-700 mt-1">
                                                        Related: {ae.treatment_related ? 'Yes' : 'No'} | Causality: {ae.causality_relationship}
                                                    </p>
                                                    <div className="text-xs text-red-500 mt-2">
                                                        Start: {formatDate(ae.ae_start_date)} {ae.ae_end_date ? `- End: ${formatDate(ae.ae_end_date)}` : '- Ongoing'}
                                                    </div>
                                                    {ae.sae_report_number && (
                                                        <div className="mt-2 text-xs font-bold bg-red-200 text-red-800 px-2 py-1 inline-block rounded">
                                                            SAE Report: {ae.sae_report_number}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-center">
                                                    <span className="block text-xs text-red-700 font-bold mb-1">Grade</span>
                                                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-red-200 text-red-800 font-bold">
                                                        {ae.severity_grade}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No adverse events reported.</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Safety Alerts */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <AlertCircle size={16} /> Active Alerts
                                    </h4>
                                    <div className="space-y-3">
                                        {safety.alerts?.length > 0 ? (
                                            safety.alerts.map((al: any, idx: number) => (
                                                <div key={idx} className={`p-3 rounded-lg border ${al.alert_severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                                    <div className="flex justify-between">
                                                        <span className="text-xs font-bold px-2 py-1 rounded bg-white">{al.alert_code}</span>
                                                        <span className="text-xs text-gray-500">{new Date(al.alert_date).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm mt-2 font-medium">{al.alert_message}</p>
                                                    <div className="mt-2 text-xs text-right">Status: <strong>{al.alert_status}</strong></div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No active safety alerts.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Protocol Deviations */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <Clipboard size={16} /> Protocol Deviations
                                    </h4>
                                    <div className="space-y-3">
                                        {safety.protocolDeviations?.length > 0 ? (
                                            safety.protocolDeviations.map((pd: any, idx: number) => (
                                                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className={`text-xs px-2 py-1 rounded font-bold ${pd.deviation_type === 'Major' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-800'}`}>
                                                            {pd.deviation_type}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{formatDate(pd.deviation_date)}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{pd.description}</p>
                                                    <div className="mt-2 text-xs">
                                                        IRB Reported: {pd.reported_to_irb ? <CheckCircle size={12} className="inline text-green-500"/> : 'No'}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No protocol deviations.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Labs Tab */}
                    {activeTab === 'labs' && (
                        <div className="card p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
                                <FileText size={20} /> Laboratory Results
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">Date</th>
                                            <th scope="col" className="px-4 py-3">Test</th>
                                            <th scope="col" className="px-4 py-3 text-right">Result</th>
                                            <th scope="col" className="px-4 py-3">Unit</th>
                                            <th scope="col" className="px-4 py-3 text-center">Reference Range</th>
                                            <th scope="col" className="px-4 py-3 text-center">Flag</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {labs.length > 0 ? (
                                            labs.map((l: any, idx: number) => (
                                                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3">{new Date(l.result_date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{l.test_name}</td>
                                                    <td className={`px-4 py-3 text-right font-bold ${l.critical_result_flag === 'Y' ? 'text-red-600' : 'text-gray-900'}`}>
                                                        {l.result_value}
                                                    </td>
                                                    <td className="px-4 py-3">{l.unit_of_measure}</td>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                        {l.reference_low} - {l.reference_high}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                            l.critical_result_flag === 'Y' ? 'bg-red-100 text-red-800' :
                                                            l.range_flag === 'High' ? 'bg-orange-100 text-orange-800' :
                                                            l.range_flag === 'Low' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                            {l.critical_result_flag === 'Y' ? 'CRITICAL' : l.range_flag}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={6} className="px-4 py-4 text-center">No lab results found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Docs Tab */}
                    {activeTab === 'docs' && (
                        <div className="card p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Clipboard size={20} /> Documents & Audit
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                {/* Informed Consent */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">Informed Consent</h4>
                                    <div className="space-y-3">
                                        {documents.consent?.length > 0 ? (
                                            documents.consent.map((c: any, idx: number) => (
                                                <div key={idx} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-bold text-blue-900">Version {c.consent_version}</span>
                                                        <span className="text-xs text-blue-700">{formatDate(c.consent_date)}</span>
                                                    </div>
                                                    <div className="text-xs font-mono text-gray-500 break-all mb-2">
                                                        Sig: {c.digital_signature_hash.substring(0, 20)}...
                                                    </div>
                                                    {c.is_withdrawn && (
                                                        <div className="mt-2 text-xs bg-red-100 text-red-800 px-2 py-1 inline-block rounded">
                                                            Withdrawn on: {formatDate(c.withdrawal_date)}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No consent records found.</p>
                                        )}
                                    </div>
                                </div>

                                {/* eCRFs */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">Signed eCRFs</h4>
                                    <div className="space-y-3">
                                        {documents.ecrfs?.length > 0 ? (
                                            documents.ecrfs.map((ecrf: any, idx: number) => (
                                                <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
                                                    <div>
                                                        <h5 className="font-medium text-gray-900">{ecrf.ecrf_name}</h5>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                            <PenTool size={10} /> {new Date(ecrf.signed_at || ecrf.data_entry_date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                        {ecrf.form_status}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded">No signed eCRFs found.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Audit Trail */}
                            <div>
                                <h4 className="font-medium text-gray-700 mb-3">Recent Audit Trail</h4>
                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                    <table className="min-w-full text-xs text-left text-gray-500">
                                        <thead className="text-gray-700 uppercase bg-gray-50 sticky top-0">
                                            <tr>
                                                <th scope="col" className="px-3 py-2">Time</th>
                                                <th scope="col" className="px-3 py-2">Table</th>
                                                <th scope="col" className="px-3 py-2">Action</th>
                                                <th scope="col" className="px-3 py-2">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documents.auditTrail?.length > 0 ? (
                                                documents.auditTrail.map((a: any, idx: number) => (
                                                    <tr key={idx} className="bg-white border-b">
                                                        <td className="px-3 py-2">{new Date(a.change_timestamp).toLocaleString()}</td>
                                                        <td className="px-3 py-2 font-mono">{a.table_name}</td>
                                                        <td className="px-3 py-2 font-bold">{a.action_type}</td>
                                                        <td className="px-3 py-2 truncate max-w-xs">{a.change_reason}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="px-3 py-4 text-center">No recent audit logs available.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
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
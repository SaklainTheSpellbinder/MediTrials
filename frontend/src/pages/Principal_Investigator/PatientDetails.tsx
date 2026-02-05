import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Printer, Mail, Phone } from 'lucide-react';
import { patientAPI } from '../../services/api';

export const PatientDetails: React.FC = () => {
    const { patient_id } = useParams<{ patient_id: string }>();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (patient_id) {
            fetchPatientDetails();
        }
    }, [patient_id]);

    const fetchPatientDetails = async () => {
        try {
            const data = await patientAPI.getById(parseInt(patient_id!));
            setPatient(data.patient);
        } catch (error) {
            console.error('Error fetching patient details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div>Loading patient details...</div>;
    }

    if (!patient) {
        return <div>Patient not found</div>;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate('/patients')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={20} /> Back to Patients
                </button>
                <div className="flex gap-2">
                    <button className="btn-secondary flex items-center gap-2">
                        <Printer size={16} /> Print
                    </button>
                    <button className="btn-primary flex items-center gap-2">
                        <Edit size={16} /> Edit
                    </button>
                </div>
            </div>

            {/* Patient Card */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold">{patient.trial_patient_id}</h1>
                        <div className="flex items-center gap-4 mt-2">
                            <span className={`px-3 py-1 rounded-full ${patient.patient_status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {patient.patient_status}
                            </span>
                            <span className="text-gray-600">Site: {patient.institution_name}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 rounded-full bg-gray-100">
                            <Phone size={18} />
                        </button>
                        <button className="p-2 rounded-full bg-gray-100">
                            <Mail size={18} />
                        </button>
                    </div>
                </div>

                {/* Patient Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                    <div>
                        <label className="text-sm text-gray-500">Date of Birth</label>
                        <p className="font-medium">{patient.date_of_birth}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Gender</label>
                        <p className="font-medium">{patient.gender}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Enrollment Date</label>
                        <p className="font-medium">{patient.enrollment_date}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500">Medical History</label>
                        <p className="font-medium">
                            {patient.medical_history_summary
                                ? JSON.stringify(patient.medical_history_summary)
                                : 'None recorded'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs for Visits, Labs, etc. */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b">
                    <nav className="flex -mb-px">
                        {['Visits', 'Lab Results', 'Adverse Events', 'Documents'].map((tab) => (
                            <button
                                key={tab}
                                className="px-4 py-3 font-medium border-b-2 border-transparent hover:text-blue-600"
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="p-6">
                    <p className="text-gray-500">Select a tab to view details</p>
                </div>
            </div>
        </div>
    );
};
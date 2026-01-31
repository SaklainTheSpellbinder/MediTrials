import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { patientAPI } from '../services/api';
import './CreatePatient.css';

export const CreatePatient: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        trial_patient_id: '',
        full_name: '',
        date_of_birth: '',
        gender: 'M',
        patient_status: 'Screened',
        enrollment_date: new Date().toISOString().split('T')[0] // Default to today
    });

    // Handle Input Changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Call your API
            const response = await patientAPI.create(formData);

            // 2. Redirect on success
            if (response.success) {
                navigate('/patients'); // Go back to the registry
            } else {
                setError(response.message || 'Failed to create patient');
            }
        } catch (err: any) {
            console.error('Submission error:', err);
            setError(err.response?.data?.message || 'Server error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-patient-container">
            {/* Header with Back Button */}
            <div className="section-header">
                <div className="header-content">
                    <button
                        onClick={() => navigate('/patients')}
                        className="back-button"
                        aria-label="Go back to patient registry"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title">New Patient Enrollment</h1>
                        <p className="text-gray-500 text-sm">Enter details for the clinical trial candidate</p>
                    </div>
                </div>
            </div>

            <div className="card">
                {error && (
                    <div className="error-alert">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="patient-form">
                    {/* Trial ID */}
                    <div className="form-group">
                        <label className="form-label">
                            Trial Patient ID <span className="required">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            name="trial_patient_id"
                            placeholder="e.g. PT-10045"
                            value={formData.trial_patient_id}
                            onChange={handleChange}
                            className="form-input"
                        />
                    </div>

                    {/* Full Name */}
                    <div className="form-group">
                        <label className="form-label">
                            Full Name <span className="required">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            name="full_name"
                            placeholder="e.g. John Smith"
                            value={formData.full_name}
                            onChange={handleChange}
                            className="form-input"
                        />
                    </div>

                    <div className="form-row">
                        {/* Date of Birth */}
                        <div className="form-group">
                            <label className="form-label">
                                Date of Birth <span className="required">*</span>
                            </label>
                            <input
                                required
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                className="form-input"
                            />
                        </div>

                        {/* Gender */}
                        <div className="form-group">
                            <label className="form-label">
                                Gender
                            </label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="form-select"
                            >
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        {/* Status */}
                        <div className="form-group">
                            <label className="form-label">
                                Initial Status
                            </label>
                            <select
                                name="patient_status"
                                value={formData.patient_status}
                                onChange={handleChange}
                                className="form-select"
                            >
                                <option value="Screened">Screened</option>
                                <option value="Enrolled">Enrolled</option>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="Withdrawn">Withdrawn</option>
                                <option value="Screen Failure">Screen Failure</option>
                            </select>
                        </div>

                    </div>

                    {/* Enrollment Date */}
                    <div className="form-group">
                        <label className="form-label">
                            Enrollment Date
                        </label>
                        <input
                            type="date"
                            name="enrollment_date"
                            value={formData.enrollment_date}
                            onChange={handleChange}
                            className="form-input"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={() => navigate('/patients')}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? (
                                <span className="spinner"></span>
                            ) : (
                                <Save size={18} />
                            )}
                            {loading ? 'Saving...' : 'Save Patient'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
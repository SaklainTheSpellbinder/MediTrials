import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Save, ArrowLeft, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import type { Patient } from './PatientList';
import './ClinicalForm.css';
import { ecrfAPI } from '../../../services/api';

// --- Interfaces ---
interface ClinicalFormProps {
  patient: Patient;
  visitInstanceId: number;
  visitName: string;
  onBack: () => void;
}

interface FormData {
  visitDate: string;
  systolicBP: string;
  diastolicBP: string;
  heartRate: string;
  temp: string;
}

export const ClinicalForm: React.FC<ClinicalFormProps> = ({ patient, visitInstanceId, visitName, onBack }) => {
  const [formData, setFormData] = useState<FormData>({
    visitDate: '',
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    temp: '',
  });

  const [submitted, setSubmitted] = useState(false);

  // ECRF submission via ecrfAPI (centralized — no local axios)
  const submitMut = useMutation({
    mutationFn: () => {
      if (!patient.db_id) throw new Error('Patient database ID not found');
      return ecrfAPI.submitWithVisit({
        patient_id: patient.db_id,
        visit_instance_id: visitInstanceId,
        measurement_time: formData.visitDate || new Date().toISOString(),
        systolic_bp: formData.systolicBP ? parseInt(formData.systolicBP) : null,
        diastolic_bp: formData.diastolicBP ? parseInt(formData.diastolicBP) : null,
        heart_rate: formData.heartRate ? parseInt(formData.heartRate) : null,
        temperature: formData.temp ? parseFloat(formData.temp) : null,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMut.mutate();
  };

  if (submitted) {
    return (
      <div className="clinical-form-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ width: '5rem', height: '5rem', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2 style={{ fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>Data Saved Successfully</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            Clinical data for <strong>{patient.patient_id}</strong> — <strong>{visitName}</strong> has been recorded and locked.
          </p>
          <button className="btn-primary" onClick={onBack}>Return to Selection Page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="clinical-form-container">
      {/* Header */}
      <div className="section-header">
        <div className="header-content">
          <button onClick={onBack} className="back-button" title="Back to Visit Selection">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="page-title">Enter Vital Signs</h1>
            <p className="text-gray-500 text-sm">
              Patient: <strong>{patient.patient_id}</strong> • Visit: <strong>{visitName}</strong> • Site: {patient.siteId}
            </p>
          </div>
        </div>
      </div>

      {/* Visit context banner */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Calendar size={18} color="#3b82f6" />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d4ed8' }}>
          Recording data against: <strong>{visitName}</strong> (Visit Instance #{visitInstanceId})
        </span>
      </div>

      <div className="card">
        {submitMut.isError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm whitespace-pre-line" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#fef2f2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #fca5a5' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            {(submitMut.error as any)?.response?.data?.error || (submitMut.error as any)?.message || 'Failed to save data. Please try again.'}
          </div>
        )}
        <form className="patient-form" onSubmit={handleSubmit}>

          {/* Section: Assessment Details */}
          <div>
            <h3 className="form-subsection-title">Assessment Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date &amp; Time of Assessment</label>
                <input
                  type="datetime-local"
                  name="visitDate"
                  className="form-input"
                  value={formData.visitDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Section: Cardiovascular */}
          <div>
            <h3 className="form-subsection-title">Cardiovascular (Sitting)</h3>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Systolic BP (mmHg)</label>
                <input type="number" name="systolicBP" placeholder="---" className="form-input" value={formData.systolicBP} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Diastolic BP (mmHg)</label>
                <input type="number" name="diastolicBP" placeholder="---" className="form-input" value={formData.diastolicBP} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Heart Rate (bpm)</label>
                <input type="number" name="heartRate" placeholder="---" className="form-input" value={formData.heartRate} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section: Other Measurements */}
          <div>
            <h3 className="form-subsection-title">Other Measurements</h3>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Temperature (°C)</label>
                <input type="number" name="temp" placeholder="36.5" step="0.1" className="form-input" value={formData.temp} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onBack} className="btn-secondary" disabled={submitMut.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitMut.isPending}>
              <Save size={18} />
              {submitMut.isPending ? 'Saving...' : 'Save Record'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
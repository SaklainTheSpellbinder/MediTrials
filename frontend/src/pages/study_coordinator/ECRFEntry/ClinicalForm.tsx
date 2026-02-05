import React, { useState } from 'react';
import { Save, ArrowLeft, Activity } from 'lucide-react';
import type { Patient } from './PatientList';
import './ClinicalForm.css';

interface ClinicalFormProps {
  patient: Patient;
  onBack: () => void;
}

export const ClinicalForm: React.FC<ClinicalFormProps> = ({ patient, onBack }) => {
  const [formData, setFormData] = useState({
    visitDate: '',
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    temp: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="clinical-form-container">
      {/* Header */}
      <div className="section-header">
        <div className="header-content">
          <button onClick={onBack} className="back-button" title="Back to Patient List">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="page-title">Enter Vital Signs</h1>
            <p className="text-gray-500 text-sm">
              Patient: <strong>{patient.patient_id}</strong> • Site: {patient.siteId}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <form className="patient-form" onSubmit={(e) => e.preventDefault()}>

          {/* Section: Assessment Details */}
          <div>
            <h3 className="form-subsection-title">Assessment Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date of Assessment</label>
                <input
                  type="date"
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
                <input
                  type="number"
                  name="systolicBP"
                  placeholder="---"
                  className="form-input"
                  value={formData.systolicBP}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  name="diastolicBP"
                  placeholder="---"
                  className="form-input"
                  value={formData.diastolicBP}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Heart Rate (bpm)</label>
                <input
                  type="number"
                  name="heartRate"
                  placeholder="---"
                  className="form-input"
                  value={formData.heartRate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Section: Other Measurements */}
          <div>
            <h3 className="form-subsection-title">Other Measurements</h3>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Temperature (°C)</label>
                <input
                  type="number"
                  name="temp"
                  placeholder="36.5"
                  className="form-input"
                  value={formData.temp}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onBack} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Save size={18} />
              Save Record
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
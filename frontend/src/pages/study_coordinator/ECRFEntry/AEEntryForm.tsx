import React, { useState } from 'react';
import { Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { Patient } from './PatientList';
import { coordinatorAPI } from '../../../services/api';
import './ClinicalForm.css'; // Reusing your existing form styles!

interface AEEntryFormProps {
  patient: Patient;
  visitInstanceId?: number;
  visitName?: string;
  onBack: () => void;
}

export const AEEntryForm: React.FC<AEEntryFormProps> = ({ patient, visitInstanceId, visitName, onBack }) => {
  const [formData, setFormData] = useState({
    ae_term: '',
    ae_start_date: new Date().toISOString().split('T')[0], // Default to today
    ae_end_date: '',
    ae_status: 'Active',
    severity_grade: '1',
    causality_relationship: 'Unrelated',
    treatment_related: false,
    results_in_death: false,
    life_threatening: false,
    requires_hospitalization: false,
    ae_description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle standard text/select inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle boolean checkbox inputs
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Frontend Validation: End Date cannot be before Start Date
    if (formData.ae_end_date && new Date(formData.ae_end_date) < new Date(formData.ae_start_date)) {
      setError('End Date cannot be earlier than Start Date.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        patient_id: patient.db_id!,
        visit_instance_id: visitInstanceId,
        ae_term: formData.ae_term,
        ae_start_date: formData.ae_start_date,
        ae_end_date: formData.ae_end_date || undefined,
        severity_grade: parseInt(formData.severity_grade),
        causality_relationship: formData.causality_relationship,
        treatment_related: formData.treatment_related,
        results_in_death: formData.results_in_death,
        life_threatening: formData.life_threatening,
        requires_hospitalization: formData.requires_hospitalization,
        ae_description: formData.ae_description,
        ae_status: formData.ae_status,
      };

      await coordinatorAPI.submitAdverseEvent(payload);
      alert('Adverse Event successfully recorded!');
      onBack();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Failed to submit Adverse Event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="clinical-form-container">
      {/* Header */}
      <div className="section-header">
        <div className="header-content">
          <button onClick={onBack} className="back-button" title="Back to menu">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="coord-badge coord-badge-red" style={{ marginBottom: '0.5rem', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} /> Adverse Event Entry
            </div>
            <h1 className="page-title">Report Adverse Event</h1>
            <p className="text-gray-500 text-sm">
              Patient: <strong>{patient.patient_id}</strong> {visitName ? `• Visit: ${visitName}` : '• Unscheduled/Spontaneous'}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm whitespace-pre-line border border-red-200">
            {error}
          </div>
        )}

        <form className="patient-form" onSubmit={handleSubmit}>
          
          {/* Section: Core Event Details */}
          <div>
            <h3 className="form-subsection-title text-red-800 border-b border-red-100 pb-2">Event Details</h3>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Adverse Event Term *</label>
                <input type="text" name="ae_term" className="form-input" placeholder="e.g. Nausea, Headache" value={formData.ae_term} onChange={handleChange} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Status</label>
                <select name="ae_status" className="form-input" value={formData.ae_status} onChange={handleChange}>
                  <option value="Active">Active</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input type="date" name="ae_start_date" className="form-input" value={formData.ae_start_date} onChange={handleChange} required max={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date (if resolved)</label>
                <input type="date" name="ae_end_date" className="form-input" value={formData.ae_end_date} onChange={handleChange} disabled={formData.ae_status === 'Active' || formData.ae_status === 'Ongoing'} />
              </div>
            </div>
          </div>

          {/* Section: Severity & Assessment */}
          <div style={{ marginTop: '2rem' }}>
            <h3 className="form-subsection-title">Clinical Assessment</h3>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Severity Grade (1-5) *</label>
                <select name="severity_grade" className="form-input" value={formData.severity_grade} onChange={handleChange} required>
                  <option value="1">1 - Mild</option>
                  <option value="2">2 - Moderate</option>
                  <option value="3">3 - Severe</option>
                  <option value="4">4 - Life-threatening</option>
                  <option value="5">5 - Death related to AE</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Causality to Trial</label>
                <select name="causality_relationship" className="form-input" value={formData.causality_relationship} onChange={handleChange}>
                  <option value="Unrelated">Unrelated</option>
                  <option value="Unlikely">Unlikely</option>
                  <option value="Possible">Possible</option>
                  <option value="Probable">Probable</option>
                  <option value="Definite">Definite</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Serious Criteria */}
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
            <h3 className="form-subsection-title" style={{ color: '#991b1b', marginBottom: '1rem' }}>Serious Adverse Event (SAE) Criteria</h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#7f1d1d' }}>
                <input type="checkbox" name="treatment_related" checked={formData.treatment_related} onChange={handleCheckboxChange} style={{ width: '1.2rem', height: '1.2rem' }} />
                Treatment Related
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#7f1d1d' }}>
                <input type="checkbox" name="requires_hospitalization" checked={formData.requires_hospitalization} onChange={handleCheckboxChange} style={{ width: '1.2rem', height: '1.2rem' }} />
                Requires Hospitalization
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#7f1d1d' }}>
                <input type="checkbox" name="life_threatening" checked={formData.life_threatening} onChange={handleCheckboxChange} style={{ width: '1.2rem', height: '1.2rem' }} />
                Life Threatening
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#7f1d1d' }}>
                <input type="checkbox" name="results_in_death" checked={formData.results_in_death} onChange={handleCheckboxChange} style={{ width: '1.2rem', height: '1.2rem' }} />
                Results in Death
              </label>
            </div>
          </div>

          {/* Section: Description */}
          <div style={{ marginTop: '2rem' }}>
            <div className="form-group">
              <label className="form-label">Detailed Description / Narrative</label>
              <textarea 
                name="ae_description" 
                className="form-input" 
                rows={4} 
                placeholder="Provide a detailed narrative of the event..."
                value={formData.ae_description} 
                onChange={handleChange} 
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions" style={{ marginTop: '2rem' }}>
            <button type="button" onClick={onBack} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} disabled={isSubmitting}>
              <Save size={18} />
              {isSubmitting ? 'Submitting...' : 'Report Adverse Event'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
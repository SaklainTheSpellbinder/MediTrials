import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { adminAPI } from '../../services/api';
import '../Dashboard.css';

const PHASES = ['Phase I', 'Phase II', 'Phase III', 'Phase IV'];
const STATUSES = ['Design', 'Recruiting', 'Active', 'Completed', 'Suspended', 'Terminated'];
const AREAS = ['Oncology', 'Cardiology', 'Neurology', 'Infectious Disease', 'Immunology', 'Endocrinology', 'Rare Diseases', 'Other'];

const fieldStyle = { border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };

interface FormState {
    trial_nct_id: string; 
    trial_title: string; 
    trial_phase: string; 
    therapeutic_area: string;
    trial_status: string; 
    start_date: string; 
    estimated_completion_date: string; 
    target_enrollment: string;
}

const empty: FormState = { 
    trial_nct_id: '', 
    trial_title: '', 
    trial_phase: 'Phase III', 
    therapeutic_area: '', 
    trial_status: 'Design', 
    start_date: '', 
    estimated_completion_date: '', 
    target_enrollment: '' 
};

export const TrialForm: React.FC = () => {
    const { trialId } = useParams();
    const isEdit = !!trialId;
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(empty);
    const [error, setError] = useState('');

    const { data: existing, isLoading } = useQuery({
        queryKey: ['admin', 'trial', trialId],
        queryFn: () => adminAPI.getTrial(trialId as string).then(data => data.trial),
        enabled: isEdit,
    });

    useEffect(() => {
        if (existing) {
            setForm({
                trial_nct_id: existing.trial_nct_id ?? '',
                trial_title: existing.trial_title ?? '',
                trial_phase: existing.trial_phase ?? 'Phase I',
                therapeutic_area: existing.therapeutic_area ?? '',
                trial_status: existing.trial_status ?? 'Design',
                start_date: existing.start_date?.split('T')[0] ?? '',
                estimated_completion_date: existing.estimated_completion_date?.split('T')[0] ?? '',
                target_enrollment: String(existing.target_enrollment ?? ''),
            });
        }
    }, [existing]);

    const save = useMutation({
        mutationFn: (data: FormState) => {
            const payload = {
                ...data,
                target_enrollment: parseInt(data.target_enrollment, 10) || 0,
                start_date: data.start_date || null,
                estimated_completion_date: data.estimated_completion_date || null,
            };

            return isEdit
                ? adminAPI.updateTrial(trialId as string, payload)
                : adminAPI.createTrial(payload);
        },
        // FIXED: Added optional chaining to prevent crashes if 'data' is undefined or missing properties
        onSuccess: (data) => {
            const nextId = data?.trial_id || data?.trial?.trial_id || trialId;
            navigate(`/admin/trials/${nextId}`);
        },
        // FIXED: Added fallback string to ensure we never pass undefined into React state
        onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'An unexpected error occurred.'),
    });

    const handleSubmit = () => {
        if (!form.trial_nct_id || !form.trial_title || !form.start_date || !form.target_enrollment) {
            setError('Please fill out all required fields.');
            return;
        }
        setError('');
        save.mutate(form);
    };

    if (isEdit && isLoading) return <div className="dashboard-container"><div className="sm-loading">Loading trial data…</div></div>;

    const getFieldStyle = (isDisabled: boolean) => ({
        ...fieldStyle,
        backgroundColor: isDisabled ? '#F3F4F6' : '#FFFFFF',
        color: isDisabled ? '#9CA3AF' : '#111827',
        cursor: isDisabled ? 'not-allowed' : 'auto'
    });

    const renderField = (label: string, name: keyof FormState, type = 'text', customInput?: React.ReactNode, isDisabled = false) => (
        <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{label}</label>
            {customInput || (
                <input 
                    type={type} 
                    value={form[name]} 
                    onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} 
                    style={getFieldStyle(isDisabled)} 
                    disabled={isDisabled} 
                />
            )}
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">{isEdit ? 'Edit Trial' : 'New Trial'}</h1>
            </div>
            <div className="card" style={{ maxWidth: 700 }}>
                {error && <div className="sm-error" style={{ marginBottom: 14, color: '#dc2626' }}>{error}</div>}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    {renderField('Trial NCT ID *', 'trial_nct_id', 'text', undefined, isEdit)}
                    
                    {renderField('Trial Phase *', 'trial_phase', 'text', 
                        <select value={form.trial_phase} onChange={e => setForm(f => ({ ...f, trial_phase: e.target.value }))} style={fieldStyle}>
                            {PHASES.map(p => <option key={p}>{p}</option>)}
                        </select>
                    )}
                    
                    <div style={{ gridColumn: '1 / -1', marginBottom: 16 }}>
                        <label style={labelStyle}>Trial Title *</label>
                        <input 
                            value={form.trial_title} 
                            onChange={e => setForm(f => ({ ...f, trial_title: e.target.value }))} 
                            style={getFieldStyle(isEdit)} 
                            disabled={isEdit} 
                        />
                    </div>
                    
                    {renderField('Therapeutic Area', 'therapeutic_area', 'text', 
                        <select 
                            value={form.therapeutic_area} 
                            onChange={e => setForm(f => ({ ...f, therapeutic_area: e.target.value }))} 
                            style={getFieldStyle(isEdit)} 
                            disabled={isEdit}
                        >
                            <option value="">Select area…</option>
                            {AREAS.map(a => <option key={a}>{a}</option>)}
                        </select>,
                        isEdit
                    )}
                    
                    {renderField('Status *', 'trial_status', 'text', 
                        <select value={form.trial_status} onChange={e => setForm(f => ({ ...f, trial_status: e.target.value }))} style={fieldStyle}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    )}
                    
                    {renderField('Start Date *', 'start_date', 'date', undefined, isEdit)}
                    {renderField('Estimated Completion *', 'estimated_completion_date', 'date', undefined, isEdit)}
                    {renderField('Target Enrollment *', 'target_enrollment', 'number')}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={handleSubmit} disabled={save.isPending} className="btn-primary">
                        {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Trial'}
                    </button>
                    <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
};
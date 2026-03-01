import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import '../Dashboard.css';

const adminApi = axios.create({ baseURL: 'http://localhost:5000' });
adminApi.interceptors.request.use(cfg => { const raw = localStorage.getItem('user'); if (raw) cfg.headers['X-User-Data'] = btoa(raw); return cfg; });

const PHASES = ['Phase I', 'Phase II', 'Phase III', 'Phase IV', 'N/A'];
const STATUSES = ['Planning', 'Recruiting', 'Active', 'Paused', 'Completed', 'Archived'];
const AREAS = ['Oncology', 'Cardiology', 'Neurology', 'Infectious Disease', 'Immunology', 'Endocrinology', 'Rare Diseases', 'Other'];

const fieldStyle = { border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };

interface FormState {
    trial_nct_id: string; trial_title: string; trial_phase: string; therapeutic_area: string;
    trial_status: string; start_date: string; estimated_completion_date: string; target_enrollment: string;
}
const empty: FormState = { trial_nct_id: '', trial_title: '', trial_phase: 'Phase III', therapeutic_area: '', trial_status: 'Planning', start_date: '', estimated_completion_date: '', target_enrollment: '' };

export const TrialForm: React.FC = () => {
    const { trialId } = useParams();
    const isEdit = !!trialId;
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(empty);
    const [error, setError] = useState('');

    const { data: existing, isLoading } = useQuery({
        queryKey: ['admin', 'trial', trialId],
        queryFn: () => adminApi.get(`/api/admin/trials/${trialId}`).then(r => r.data.trial),
        enabled: isEdit,
    });

    useEffect(() => {
        if (existing) {
            setForm({
                trial_nct_id: existing.trial_nct_id ?? '',
                trial_title: existing.trial_title ?? '',
                trial_phase: existing.trial_phase ?? 'Phase III',
                therapeutic_area: existing.therapeutic_area ?? '',
                trial_status: existing.trial_status ?? 'Planning',
                start_date: existing.start_date?.split('T')[0] ?? '',
                estimated_completion_date: existing.estimated_completion_date?.split('T')[0] ?? '',
                target_enrollment: String(existing.target_enrollment ?? ''),
            });
        }
    }, [existing]);

    const save = useMutation({
        mutationFn: (data: FormState) => isEdit
            ? adminApi.put(`/api/admin/trials/${trialId}`, data).then(r => r.data)
            : adminApi.post('/api/admin/trials', data).then(r => r.data),
        onSuccess: (data) => navigate(`/admin/trials/${data.trial_id ?? trialId}`),
        onError: (e: any) => setError(e.response?.data?.error ?? e.message),
    });

    if (isEdit && isLoading) return <div className="dashboard-container"><div className="sm-loading">Loading trial data…</div></div>;

    const Field = ({ label, name, type = 'text', children }: { label: string; name: keyof FormState; type?: string; children?: React.ReactNode }) => (
        <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{label}</label>
            {children || (
                <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} style={fieldStyle} />
            )}
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">{isEdit ? 'Edit Trial' : 'New Trial'}</h1>
            </div>
            <div className="card" style={{ maxWidth: 700 }}>
                {error && <div className="sm-error" style={{ marginBottom: 14 }}>{error}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <Field label="Trial NCT ID *" name="trial_nct_id" />
                    <Field label="Trial Phase *" name="trial_phase">
                        <select value={form.trial_phase} onChange={e => setForm(f => ({ ...f, trial_phase: e.target.value }))} style={fieldStyle}>
                            {PHASES.map(p => <option key={p}>{p}</option>)}
                        </select>
                    </Field>
                    <div style={{ gridColumn: '1 / -1', marginBottom: 16 }}>
                        <label style={labelStyle}>Trial Title *</label>
                        <input value={form.trial_title} onChange={e => setForm(f => ({ ...f, trial_title: e.target.value }))} style={fieldStyle} />
                    </div>
                    <Field label="Therapeutic Area" name="therapeutic_area">
                        <select value={form.therapeutic_area} onChange={e => setForm(f => ({ ...f, therapeutic_area: e.target.value }))} style={fieldStyle}>
                            <option value="">Select area…</option>
                            {AREAS.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </Field>
                    <Field label="Status *" name="trial_status">
                        <select value={form.trial_status} onChange={e => setForm(f => ({ ...f, trial_status: e.target.value }))} style={fieldStyle}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </Field>
                    <Field label="Start Date *" name="start_date" type="date" />
                    <Field label="Estimated Completion *" name="estimated_completion_date" type="date" />
                    <Field label="Target Enrollment *" name="target_enrollment" type="number" />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={() => save.mutate(form)} disabled={save.isPending} className="btn-primary">
                        {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Trial'}
                    </button>
                    <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
};

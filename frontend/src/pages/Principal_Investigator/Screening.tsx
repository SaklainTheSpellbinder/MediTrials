import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, CheckCircle, AlertCircle, ClipboardList,
    RefreshCw, AlertTriangle, Send, Save, Heart, Activity
} from 'lucide-react';
import { screeningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Screening.css';

// ─── Types ───────────────────────────────────────────────────────────
interface CriterionDef {
    criterion_id: number;
    criterion_type: 'Inclusion' | 'Exclusion';
    criterion_text: string;
    is_mandatory: boolean;
    criterion_logic: string | null;
}

interface ScreeningFormData {
    systolic_bp: string;
    diastolic_bp: string;
    heart_rate: string;
    temperature: string;
    spo2: string;
    height_cm: string;
    weight_kg: string;
    smoking_status: string;
    current_medications: string;
    is_pregnant: boolean;
    has_uncontrolled_diabetes: boolean;
    has_active_cancer: boolean;
    has_severe_allergy: boolean;
    recent_trial_participation: boolean;
    notes: string;
}

const INITIAL_FORM: ScreeningFormData = {
    systolic_bp: '', diastolic_bp: '', heart_rate: '', temperature: '', spo2: '',
    height_cm: '', weight_kg: '', smoking_status: 'Never', current_medications: '',
    is_pregnant: false, has_uncontrolled_diabetes: false, has_active_cancer: false,
    has_severe_allergy: false, recent_trial_participation: false, notes: '',
};

// ─── Auto-evaluate a single criterion against form data ──────────
function evalCriterion(logic: string | null, form: ScreeningFormData, patientAge: number | null): boolean | null {
    if (!logic) return null; // no auto-eval rule → manual
    const n = (v: string) => parseFloat(v);
    switch (logic) {
        case 'age_18_75':
            return patientAge != null && patientAge >= 18 && patientAge <= 75;
        case 'systolic_90_180':
            return form.systolic_bp !== '' && n(form.systolic_bp) >= 90 && n(form.systolic_bp) <= 180;
        case 'diastolic_60_110':
            return form.diastolic_bp !== '' && n(form.diastolic_bp) >= 60 && n(form.diastolic_bp) <= 110;
        case 'hr_50_110':
            return form.heart_rate !== '' && n(form.heart_rate) >= 50 && n(form.heart_rate) <= 110;
        case 'temp_normal':
            return form.temperature !== '' && n(form.temperature) >= 35.5 && n(form.temperature) <= 37.5;
        case 'not_pregnant':
            return !form.is_pregnant;
        case 'no_uncontrolled_diabetes':
            return !form.has_uncontrolled_diabetes;
        case 'no_active_cancer':
            return !form.has_active_cancer;
        case 'no_severe_allergy':
            return !form.has_severe_allergy;
        case 'no_recent_trial':
            return !form.recent_trial_participation;
        default:
            return null;
    }
}

// ─── Component ──────────────────────────────────────────────────────
export const Screening: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const qc = useQueryClient();
    const { patient_id } = useParams<{ patient_id: string }>();
    const pid = parseInt(patient_id || '0');

    // Local Form State
    const [form, setForm] = useState<ScreeningFormData>(INITIAL_FORM);
    const [patientAge, setPatientAge] = useState<number | null>(null);
    const [manualOverride, setManualOverride] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // ─── Queries ────────────────────────────────────────────────────────
    const { data: criteria = [], isLoading: criteriaLoading } = useQuery({
        queryKey: ['eligibility-criteria', user?.site_id],
        queryFn: async () => {
            const data = await screeningAPI.getCriteria(user!.site_id!);
            return data.criteria || [];
        },
        enabled: !!user?.site_id,
    });

    const { data: draftData, isLoading: draftLoading } = useQuery({
        queryKey: ['screening-draft', pid],
        queryFn: () => screeningAPI.getDraft(pid),
        enabled: !!pid,
        retry: false // It's okay if it fails (means no draft exists yet)
    });

    // Populate local form state when draft data loads
    useEffect(() => {
        const s = draftData?.screening;
        if (s) {
            if (s.date_of_birth) {
                const dob = new Date(s.date_of_birth);
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                setPatientAge(age);
            }
            if (s.screening_data && Object.keys(s.screening_data).length > 0) {
                setForm(prev => ({ ...prev, ...s.screening_data }));
            }
            if (s.manual_override) setManualOverride(true);
            if (s.parsed_justification) setOverrideReason(s.parsed_justification);
        }
    }, [draftData]);

    // const saveDraftMut = useMutation({
    //     mutationFn: (payload: any) => screeningAPI.saveChecklistDraft(pid, payload),
    //     onSuccess: () => {
    //         setSuccessMsg('Draft saved successfully.');
    //         setErrorMsg(null);
    //         qc.invalidateQueries({ queryKey: ['screening-draft', pid] });
    //     },
    //     onError: (err: any) => {
    //         setErrorMsg(err?.response?.data?.error || 'Failed to save draft.');
    //         setSuccessMsg(null);
    //     }
    // });

    const submitPIMut = useMutation({
        mutationFn: (payload: any) => screeningAPI.submitForPiReview(pid, payload),
        onSuccess: () => {
            setSuccessMsg('Submitted to PI for review!');
            setErrorMsg(null);
            qc.invalidateQueries({ queryKey: ['pending-pi-review'] });
            setTimeout(() => navigate('/patients'), 1500); 
        },
        onError: (err: any) => {
            setErrorMsg(err?.response?.data?.error || 'Submission failed.');
            setSuccessMsg(null);
        }
    });

    //Evaluate all criteria against current form data
    const evaluated = criteria.map((c: CriterionDef) => {
        const pass = evalCriterion(c.criterion_logic, form, patientAge);
        return { ...c, pass };
    });

    const failures = evaluated.filter((c: any) => c.pass === false);
    const mandatoryFailures = failures.filter((c: any) => c.is_mandatory);
    const totalEvaluated = evaluated.filter((c: any) => c.pass !== null).length;
    const totalPassed = evaluated.filter((c: any) => c.pass === true).length;
    const score = totalEvaluated > 0 ? Math.round((totalPassed / totalEvaluated) * 100) : 100;

    const verdict: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' =
        mandatoryFailures.length === 0 ? 'ELIGIBLE' : manualOverride ? 'PENDING' : 'INELIGIBLE';

    const canSubmit = criteria.length > 0 && (
        verdict === 'ELIGIBLE' ||
        (manualOverride && overrideReason.trim().length >= 20)
    );

    // ─── Build payload ────────────────────────────────────────────
    const buildPayload = () => ({
        eligibility_score: score,
        manual_override: manualOverride,
        override_reason: overrideReason,
        screening_data: form,
        failures: failures.map((f: any) => ({
            criterion_id: f.criterion_id,
            failure_reason: f.criterion_text,
            override_approved: manualOverride,
        })),
    });

    // ─── Style helpers ─────────────────────────────────────────────
    const verdictClass = verdict === 'ELIGIBLE' ? 'verdict-eligible'
        : verdict === 'INELIGIBLE' ? 'verdict-ineligible' : 'verdict-pending';
    const scoreBanner = verdict === 'ELIGIBLE' ? 'score-eligible'
        : verdict === 'INELIGIBLE' ? 'score-ineligible' : 'score-pending';

    const updateField = (key: keyof ScreeningFormData, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
        // Clear success messages on edit
        if (successMsg) setSuccessMsg(null);
    };

    if (!patient_id) return <div className="screening-container"><div className="card p-8 text-center text-red-500">No patient selected.</div></div>;

    return (
        <div className="screening-container">
            {/* Header */}
            <div className="screening-page-header">
                <button className="back-btn" onClick={() => navigate('/patients')}><ArrowLeft size={18} /></button>
                <div>
                    <h1>Screening Data Entry</h1>
                    <p>Patient #{patient_id} {patientAge ? `· ${patientAge} yrs old` : ''} — Enter vitals and medical screening data. Eligibility auto-evaluates.</p>
                </div>
            </div>

            {criteriaLoading || draftLoading ? (
                <div className="screening-card">
                    <div className="screening-card-body" style={{ padding: 48, textAlign: 'center' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ display: 'block', margin: '0 auto 12px' }} />
                        <span style={{ color: 'var(--gray-400)' }}>Loading eligibility criteria…</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Alerts */}
                    {errorMsg && <div className="screening-error"><AlertCircle size={18} /><span>{errorMsg}</span></div>}
                    {successMsg && <div style={{ padding: '10px 14px', background: '#f0fdf4', color: '#166534', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}><CheckCircle size={16} />{successMsg}</div>}

                    {/* ── SECTION 1: Vitals ─────────────────────────────────── */}
                    <div className="screening-card">
                        <div className="screening-card-header">
                            <div className="screening-card-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                                <Heart size={20} />
                            </div>
                            <div><h2>Vital Signs</h2><p>Record screening vitals</p></div>
                        </div>
                        <div className="screening-card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Systolic BP (mmHg) *</label>
                                    <input type="number" className="form-input" placeholder="e.g. 120"
                                        value={form.systolic_bp} onChange={e => updateField('systolic_bp', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Diastolic BP (mmHg) *</label>
                                    <input type="number" className="form-input" placeholder="e.g. 80"
                                        value={form.diastolic_bp} onChange={e => updateField('diastolic_bp', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Heart Rate (bpm) *</label>
                                    <input type="number" className="form-input" placeholder="e.g. 72"
                                        value={form.heart_rate} onChange={e => updateField('heart_rate', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Temperature (°C)</label>
                                    <input type="number" step="0.1" className="form-input" placeholder="e.g. 36.6"
                                        value={form.temperature} onChange={e => updateField('temperature', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SpO₂ (%)</label>
                                    <input type="number" className="form-input" placeholder="e.g. 98"
                                        value={form.spo2} onChange={e => updateField('spo2', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Height (cm)</label>
                                    <input type="number" className="form-input" placeholder="e.g. 170"
                                        value={form.height_cm} onChange={e => updateField('height_cm', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Weight (kg)</label>
                                    <input type="number" step="0.1" className="form-input" placeholder="e.g. 72.5"
                                        value={form.weight_kg} onChange={e => updateField('weight_kg', e.target.value)} />
                                </div>
                            </div>
                            {form.height_cm && form.weight_kg && (
                                <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                                    BMI: <strong>{(parseFloat(form.weight_kg) / Math.pow(parseFloat(form.height_cm) / 100, 2)).toFixed(1)}</strong> kg/m²
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── SECTION 2: Medical Screening Questions ───────────── */}
                    <div className="screening-card">
                        <div className="screening-card-header">
                            <div className="screening-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                                <ClipboardList size={20} />
                            </div>
                            <div><h2>Medical Screening</h2><p>Confirm the following conditions</p></div>
                        </div>
                        <div className="screening-card-body">
                            {[
                                { key: 'is_pregnant' as const, label: 'Is the patient currently pregnant or planning pregnancy?' },
                                { key: 'has_uncontrolled_diabetes' as const, label: 'Does the patient have uncontrolled diabetes (HbA1c > 9%)?' },
                                { key: 'has_active_cancer' as const, label: 'Does the patient have active malignancy (cancer under treatment)?' },
                                { key: 'has_severe_allergy' as const, label: 'Does the patient have a history of severe allergic reaction (anaphylaxis)?' },
                                { key: 'recent_trial_participation' as const, label: 'Has the patient participated in another clinical trial within the last 30 days?' },
                            ].map(q => (
                                <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--gray-700)', flex: 1 }}>{q.label}</span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className={`toggle-pass ${!form[q.key] ? 'active' : ''}`}
                                            onClick={() => updateField(q.key, false)}
                                        >No</button>
                                        <button
                                            className={`toggle-fail ${form[q.key] ? 'active' : ''}`}
                                            onClick={() => updateField(q.key, true)}
                                        >Yes</button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Smoking Status</label>
                                    <select className="form-select" value={form.smoking_status} onChange={e => updateField('smoking_status', e.target.value)}>
                                        <option value="Never">Never Smoked</option>
                                        <option value="Former">Former Smoker</option>
                                        <option value="Current">Current Smoker</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Current Medications</label>
                                    <input type="text" className="form-input" placeholder="e.g. Metformin 500mg, Aspirin"
                                        value={form.current_medications} onChange={e => updateField('current_medications', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 16 }}>
                                <label className="form-label">Additional Notes</label>
                                <textarea className="form-textarea" rows={2} placeholder="Any other observations…"
                                    value={form.notes} onChange={e => updateField('notes', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* ── SECTION 3: Auto-Evaluated Criteria ─────────────── */}
                    <div className="screening-card">
                        <div className="screening-card-header">
                            <div className="screening-card-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                                <Activity size={20} />
                            </div>
                            <div><h2>Eligibility Evaluation</h2><p>Auto-evaluated from entered data</p></div>
                        </div>
                        <div className="screening-card-body">
                            {/* Score Banner */}
                            <div className={`eligibility-score-banner ${scoreBanner}`}>
                                <div>
                                    <div className="score-label">Eligibility Score</div>
                                    <div className="score-value" style={{
                                        color: verdict === 'ELIGIBLE' ? 'var(--color-success)' : verdict === 'INELIGIBLE' ? 'var(--color-danger)' : 'var(--color-warning)'
                                    }}>{score}%</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginBottom: 6 }}>
                                        {failures.length} of {criteria.length} criteria unmet
                                    </div>
                                    <span className={`verdict-badge ${verdictClass}`}>{verdict}</span>
                                </div>
                            </div>

                            {/* Criteria List */}
                            {evaluated.map((c: any) => {
                                const passStatus = c.pass === null ? 'pending' : c.pass ? 'pass' : 'fail';
                                const icon = c.pass === true ? '✓' : c.pass === false ? '✗' : '—';
                                const bgColor = passStatus === 'pass' ? '#f0fdf4' : passStatus === 'fail' ? '#fef2f2' : '#f9fafb';
                                const borderColor = passStatus === 'pass' ? '#bbf7d0' : passStatus === 'fail' ? '#fecaca' : '#e5e7eb';
                                return (
                                    <div key={c.criterion_id} style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 14px', marginBottom: 6, borderRadius: 8,
                                        background: bgColor, border: `1px solid ${borderColor}`,
                                    }}>
                                        <span style={{
                                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 700, fontSize: '0.85rem',
                                            background: passStatus === 'pass' ? '#dcfce7' : passStatus === 'fail' ? '#fee2e2' : '#f3f4f6',
                                            color: passStatus === 'pass' ? '#15803d' : passStatus === 'fail' ? '#b91c1c' : '#6b7280',
                                        }}>{icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--gray-800)' }}>{c.criterion_text}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginLeft: 8 }}>
                                                [{c.criterion_type}]{c.is_mandatory ? ' · Mandatory' : ''}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Manual Override */}
                            {mandatoryFailures.length > 0 && (
                                <div style={{ marginTop: 'var(--spacing-6)' }}>
                                    <div className="override-toggle-row">
                                        <div>
                                            <div className="override-toggle-label">
                                                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                                                Request PI Manual Override
                                            </div>
                                            <div className="override-toggle-desc">Enable only for borderline cases.</div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={manualOverride} onChange={e => setManualOverride(e.target.checked)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                    {manualOverride && (
                                        <div className="form-group">
                                            <label className="form-label">Override Justification *</label>
                                            <textarea className="form-textarea" rows={3}
                                                placeholder="Clinical justification for allowing this patient to proceed…"
                                                value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
                                            <p className="form-hint">{overrideReason.length}/20 characters minimum</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="form-actions" style={{ marginTop: 'var(--spacing-6)' }}>
                                <button className="btn-secondary" onClick={() => navigate('/patients')}>
                                    <ArrowLeft size={15} /> Cancel
                                </button>
                                {/* <button className="btn-secondary" disabled={saveDraftMut.isPending || criteria.length === 0} onClick={() => saveDraftMut.mutate(buildPayload())}>
                                    <Save size={14} /> {saveDraftMut.isPending ? 'Saving…' : 'Save Draft'}
                                </button> */}
                                <button className="btn-primary" disabled={!canSubmit || submitPIMut.isPending} onClick={() => submitPIMut.mutate(buildPayload())}>
                                    <Send size={14} /> {submitPIMut.isPending ? 'Submitting…' : 'Submit to PI'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle, AlertCircle, FileText, Shield,
    Heart, XCircle, User,
} from 'lucide-react';
import { screeningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Screening.css';

export const ScreeningReview: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { patient_id } = useParams<{ patient_id: string }>();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitResult, setSubmitResult] = useState<{ type: 'approve' | 'deny'; message: string } | null>(null);

    const [draft, setDraft] = useState<any>(null);

    const [eSignPassword, setEsignPassword] = useState('');
    const [piAttestation, setPiAttestation] = useState(false);

    useEffect(() => { if (patient_id) loadData(parseInt(patient_id)); }, [patient_id]);

    const loadData = async (id: number) => {
        try {
            setLoading(true);
            const data = await screeningAPI.getDraft(id);
            setDraft(data.screening);
        } catch (err) {
            setError('Failed to load screening review details.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const consentOnFile = !!(draft?.recorded_consent_version);
    const sd = draft?.screening_data || {};

    const handleAction = async (action: 'approve' | 'deny') => {
        if (!eSignPassword || !piAttestation) return;
        setError(null);
        setSubmitting(true);
        try {
            await screeningAPI.piEnroll(parseInt(patient_id!, 10), {
                e_signature_password: eSignPassword,
                submitted_by_user_id: user?.user_id ?? 0,
                attestation_acknowledged: true,
                action,
            });
            setSubmitResult({
                type: action,
                message: action === 'approve'
                    ? 'Patient has been enrolled in the trial successfully.'
                    : 'Patient screening denied. Status set to Screen Failure.',
            });
            // Auto-redirect back to screening queue after 2s
            setTimeout(() => navigate('/patients/screening'), 2000);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to complete sign-off. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading ─────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="screening-container">
                <div className="screening-card">
                    <div className="screening-card-body" style={{ padding: 48, textAlign: 'center' }}>
                        <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--gray-200)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 16px' }} />
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Loading screening review…</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Result Screen ───────────────────────────────────────────
    if (submitResult) {
        const isApproved = submitResult.type === 'approve';
        return (
            <div className="screening-container">
                <div className="screening-card">
                    <div className="screening-card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isApproved ? '#dcfce7' : '#fee2e2',
                        }}>
                            {isApproved
                                ? <CheckCircle size={36} style={{ color: '#15803d' }} />
                                : <XCircle size={36} style={{ color: '#b91c1c' }} />
                            }
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
                            {isApproved ? 'Patient Enrolled' : 'Screening Denied'}
                        </h2>
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 24px' }}>
                            {submitResult.message}
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn-primary" onClick={() => navigate('/patients')}>Return to Registry</button>
                            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>Dashboard</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Not found ───────────────────────────────────────────────
    if (!draft) {
        return (
            <div className="screening-container">
                <div className="screening-card">
                    <div className="screening-card-body" style={{ textAlign: 'center', padding: 48 }}>
                        <AlertCircle size={40} style={{ color: 'var(--color-danger)', margin: '0 auto 12px', display: 'block' }} />
                        <p style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Screening not found for this patient.</p>
                        <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/patients')}>Back to Registry</button>
                    </div>
                </div>
            </div>
        );
    }

    const calcAge = () => {
        try {
            const dob = new Date(draft.date_of_birth);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
            return age;
        } catch { return '—'; }
    };
    const age = calcAge();
    const isOverride = draft.manual_override;
    const justification = draft.parsed_justification || '';
    const hasVitals = sd.systolic_bp || sd.diastolic_bp || sd.heart_rate;
    const hasMedical = sd.is_pregnant !== undefined;
    const hasBodyMetrics = sd.height_cm || sd.weight_kg;

    // Vital card component
    const VitalCard = ({ label, value, unit }: { label: string; value: any; unit: string }) => {
        if (!value) return null;
        return (
            <div style={{
                background: 'white', padding: '12px 16px', borderRadius: 10,
                border: '1px solid var(--gray-200)', textAlign: 'center', minWidth: 110,
            }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--gray-900)' }}>
                    {value}
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--gray-400)', marginLeft: 3 }}>{unit}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="screening-container">
            {/* Header */}
            <div className="screening-page-header">
                <button className="back-btn" onClick={() => navigate('/patients')}><ArrowLeft size={18} /></button>
                <div>
                    <h1>PI Screening Review</h1>
                    <p>Review coordinator's screening data and enter your decision for patient <strong>{draft.trial_patient_id}</strong></p>
                </div>
            </div>

            {error && (
                <div className="screening-error"><AlertCircle size={18} /><span>{error}</span></div>
            )}

            {/* ── Card 1: Patient Info ─────────────────────────────── */}
            <div className="screening-card">
                <div className="screening-card-header">
                    <div className="screening-card-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                        <User size={20} />
                    </div>
                    <div><h2>Patient Information</h2><p>Demographics and screening summary</p></div>
                </div>
                <div className="screening-card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Patient Name</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>{draft.full_name || draft.trial_patient_id}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Trial ID</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)', fontFamily: 'var(--font-mono)' }}>{draft.trial_patient_id}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Age / Gender</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>{age} yrs / {draft.gender}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Status</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gray-900)' }}>{draft.patient_status}</div>
                        </div>
                    </div>

                    {/* Score + Consent Row */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
                        <div style={{
                            flex: 1, minWidth: 200, padding: '14px 18px', borderRadius: 10,
                            background: draft.eligibility_score >= 80 ? '#f0fdf4' : '#fff8f8',
                            border: `1px solid ${draft.eligibility_score >= 80 ? '#bbf7d0' : '#fecaca'}`,
                            display: 'flex', alignItems: 'center', gap: 14,
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: draft.eligibility_score >= 80 ? '#dcfce7' : '#fee2e2',
                                fontWeight: 800, fontSize: '1rem',
                                color: draft.eligibility_score >= 80 ? '#15803d' : '#b91c1c',
                            }}>
                                {draft.eligibility_score}%
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-800)' }}>Eligibility Score</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                                    {isOverride
                                        ? <span style={{ color: '#d97706', fontWeight: 600 }}>⚠ Override requested by coordinator</span>
                                        : <span style={{ color: '#15803d', fontWeight: 600 }}>✓ All mandatory criteria met</span>
                                    }
                                </div>
                            </div>
                        </div>

                        {consentOnFile && (
                            <div style={{
                                flex: 1, minWidth: 200, padding: '14px 18px', borderRadius: 10,
                                background: '#eff6ff', border: '1px solid #bfdbfe',
                                display: 'flex', alignItems: 'center', gap: 14,
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: '#dbeafe',
                                }}>
                                    <FileText size={20} style={{ color: '#2563eb' }} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-800)' }}>Consent on File</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                                        Version {draft.recorded_consent_version} · {draft.recorded_consent_date ? new Date(draft.recorded_consent_date).toLocaleDateString() : '—'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Card 2: Screening Data ───────────────────────────── */}
            {(hasVitals || hasMedical) && (
                <div className="screening-card">
                    <div className="screening-card-header">
                        <div className="screening-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                            <Heart size={20} />
                        </div>
                        <div><h2>Screening Data</h2><p>Entered by study coordinator</p></div>
                    </div>
                    <div className="screening-card-body">
                        {/* Vitals Grid */}
                        {hasVitals && (
                            <>
                                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                                    Vital Signs
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
                                    <VitalCard label="Systolic BP" value={sd.systolic_bp} unit="mmHg" />
                                    <VitalCard label="Diastolic BP" value={sd.diastolic_bp} unit="mmHg" />
                                    <VitalCard label="Heart Rate" value={sd.heart_rate} unit="bpm" />
                                    <VitalCard label="Temperature" value={sd.temperature} unit="°C" />
                                    <VitalCard label="SpO₂" value={sd.spo2} unit="%" />
                                    <VitalCard label="Height" value={sd.height_cm} unit="cm" />
                                    <VitalCard label="Weight" value={sd.weight_kg} unit="kg" />
                                    {sd.height_cm && sd.weight_kg && (
                                        <VitalCard
                                            label="BMI"
                                            value={(parseFloat(sd.weight_kg) / Math.pow(parseFloat(sd.height_cm) / 100, 2)).toFixed(1)}
                                            unit="kg/m²"
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        {/* Smoking / Medications row */}
                        {(sd.smoking_status || sd.current_medications) && (
                            <div style={{ display: 'grid', gridTemplateColumns: sd.current_medications ? '1fr 2fr' : '1fr', gap: 10, marginBottom: 20 }}>
                                {sd.smoking_status && (
                                    <div style={{ background: 'white', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Smoking Status</div>
                                        <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{sd.smoking_status}</div>
                                    </div>
                                )}
                                {sd.current_medications && (
                                    <div style={{ background: 'white', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Current Medications</div>
                                        <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.9rem' }}>{sd.current_medications}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Medical Screening Questions */}
                        {hasMedical && (
                            <>
                                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                                    Medical Screening
                                </h4>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    {[
                                        { key: 'is_pregnant', label: 'Pregnant or planning pregnancy' },
                                        { key: 'has_uncontrolled_diabetes', label: 'Uncontrolled diabetes (HbA1c > 9%)' },
                                        { key: 'has_active_cancer', label: 'Active malignancy (cancer under treatment)' },
                                        { key: 'has_severe_allergy', label: 'Severe allergic reaction history (anaphylaxis)' },
                                        { key: 'recent_trial_participation', label: 'Participated in another trial within 30 days' },
                                    ].map(q => {
                                        const val = sd[q.key];
                                        const isBad = val === true;
                                        return (
                                            <div key={q.key} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '10px 14px', borderRadius: 8,
                                                background: isBad ? '#fef2f2' : '#f0fdf4',
                                                border: `1px solid ${isBad ? '#fecaca' : '#bbf7d0'}`,
                                            }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>{q.label}</span>
                                                <span style={{
                                                    fontWeight: 700, fontSize: '0.78rem', padding: '3px 10px', borderRadius: 20,
                                                    background: isBad ? '#fee2e2' : '#dcfce7',
                                                    color: isBad ? '#b91c1c' : '#15803d',
                                                }}>{val ? 'YES' : 'NO'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* Notes */}
                        {sd.notes && (
                            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                                <strong style={{ color: 'var(--gray-800)' }}>Coordinator Notes:</strong> {sd.notes}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Card 3: Override Justification (only if override) ── */}
            {isOverride && (
                <div className="screening-card" style={{ borderLeft: '4px solid #d97706' }}>
                    <div className="screening-card-header" style={{ background: '#fffbeb' }}>
                        <div className="screening-card-icon" style={{ background: '#fde68a', color: '#92400e' }}>
                            <AlertCircle size={20} />
                        </div>
                        <div><h2 style={{ color: '#92400e' }}>Override Justification</h2><p style={{ color: '#b45309' }}>Coordinator has flagged for PI review</p></div>
                    </div>
                    <div className="screening-card-body" style={{ background: '#fffef5' }}>
                        <p style={{ color: '#78350f', fontSize: '0.9rem', lineHeight: 1.6 }}>{justification || 'No justification provided.'}</p>
                        {draft.failures && draft.failures.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 6 }}>Failed Criteria</div>
                                {draft.failures.map((f: any, i: number) => (
                                    <div key={i} style={{
                                        padding: '6px 12px', marginBottom: 4, borderRadius: 6,
                                        background: '#fef2f2', border: '1px solid #fecaca',
                                        fontSize: '0.82rem', color: '#991b1b',
                                    }}>
                                        Criterion #{f.criterion_id}: {f.failure_reason}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Card 4: PI Decision ─────────────────────────────── */}
            <div className="screening-card">
                <div className="screening-card-header">
                    <div className="screening-card-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                        <Shield size={20} />
                    </div>
                    <div><h2>PI Decision</h2><p>21 CFR Part 11 compliant electronic signature</p></div>
                </div>
                <div className="screening-card-body">
                    {/* Legal notice */}
                    <div style={{
                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
                        padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start',
                        fontSize: '0.82rem', color: '#1e40af',
                    }}>
                        <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>By signing below you attest that you have reviewed the eligibility documentation and the coordinator's screening data. Your e-signature will be timestamped and hashed per 21 CFR Part 11.</span>
                    </div>

                    {/* Attestation */}
                    <div style={{
                        padding: '14px 16px', borderRadius: 8, marginBottom: 16,
                        background: piAttestation ? '#f0fdf4' : '#f9fafb',
                        border: `1px solid ${piAttestation ? '#bbf7d0' : 'var(--gray-200)'}`,
                        transition: 'all 0.2s',
                    }}>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                            <input type="checkbox" checked={piAttestation} onChange={e => setPiAttestation(e.target.checked)}
                                style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                            <span>I am the <strong>Principal Investigator</strong> and confirm that I have reviewed all screening data, vital signs, medical findings, and eligibility evaluation for this participant.</span>
                        </label>
                    </div>

                    {/* E-Signature */}
                    <div className="form-group" style={{ maxWidth: 400, marginBottom: 20 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Shield size={13} /> E-Signature — Password Re-entry
                        </label>
                        <input type="password" className="form-input"
                            placeholder="Enter your system password to sign"
                            value={eSignPassword} onChange={e => setEsignPassword(e.target.value)} />
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: 12,
                        paddingTop: 16, borderTop: '1px solid var(--gray-200)',
                    }}>
                        <button className="btn-secondary" onClick={() => navigate('/patients')}>
                            <ArrowLeft size={14} /> Cancel
                        </button>
                        <button
                            style={{
                                padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem',
                                background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer',
                                opacity: (!piAttestation || !eSignPassword || submitting) ? 0.45 : 1,
                                display: 'flex', alignItems: 'center', gap: 8,
                                transition: 'opacity 0.2s, transform 0.1s',
                            }}
                            disabled={!piAttestation || !eSignPassword || submitting}
                            onClick={() => handleAction('deny')}
                            onMouseEnter={e => { if (!submitting) (e.target as HTMLElement).style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => (e.target as HTMLElement).style.transform = 'none'}
                        >
                            <XCircle size={16} /> {submitting ? 'Processing…' : 'Deny — Screen Failure'}
                        </button>
                        <button
                            className="btn-primary"
                            style={{ padding: '10px 22px', fontWeight: 700 }}
                            disabled={!piAttestation || !eSignPassword || submitting}
                            onClick={() => handleAction('approve')}
                        >
                            <CheckCircle size={16} /> {submitting ? 'Processing…' : 'Approve & Enroll'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

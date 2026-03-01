import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, CheckCircle, AlertCircle,
    User, ClipboardList, FileText, Shield,
    RefreshCw, AlertTriangle, Lock, Check
} from 'lucide-react';
import { screeningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Screening.css';

// ─── Types ───────────────────────────────────────────────────────────
interface Criterion {
    criterion_id: number;
    criterion_type: 'Inclusion' | 'Exclusion';
    criterion_text: string;
    is_mandatory: boolean;
    criterion_logic: string | null;
}

interface CriterionState {
    criterion_id: number;
    criterion_type: 'Inclusion' | 'Exclusion';
    criterion_text: string;
    is_mandatory: boolean;
    // Pass = true means: inclusion is met / exclusion is NOT present
    pass: boolean;
    failure_reason: string;
}

interface ProtocolVersion {
    protocol_id: number;
    version_number: string;
    approval_date: string;
    valid_from: string;
}

type ScreeningResult = {
    patient_id: number;
    trial_patient_id: string;
    screening_number: string;
    screening_id: number;
    consent_id: number | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

export const Screening: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // ── Wizard Step
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<ScreeningResult | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Step 1: Demographics
    const [demographics, setDemographics] = useState({
        full_name: '',
        date_of_birth: '',
        gender: 'Male',
    });

    // ── Step 2: Eligibility
    const [criteria, setCriteria] = useState<CriterionState[]>([]);
    const [criteriaLoading, setCriteriaLoading] = useState(false);
    const [manualOverride, setManualOverride] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');

    // ── Step 3: Consent
    const [versions, setVersions] = useState<ProtocolVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [consentDate, setConsentDate] = useState(today());
    const [eSignPassword, setESignPassword] = useState('');

    // ─── Load eligibility criteria when entering Step 2
    useEffect(() => {
        if (step === 2 && criteria.length === 0) {
            loadCriteria();
        }
    }, [step]);

    // ─── Load protocol versions when entering Step 3
    useEffect(() => {
        if (step === 3 && versions.length === 0) {
            loadVersions();
        }
    }, [step]);

    const loadCriteria = async () => {
        if (!user?.site_id) {
            // Fallback in-memory criteria for demo if no site_id
            setCriteria([
                { criterion_id: 1, criterion_type: 'Inclusion', criterion_text: 'Age 18–75 years at time of screening', is_mandatory: true, pass: true, failure_reason: '' },
                { criterion_id: 2, criterion_type: 'Inclusion', criterion_text: 'Confirmed diagnosis of the target condition per standard criteria', is_mandatory: true, pass: true, failure_reason: '' },
                { criterion_id: 3, criterion_type: 'Inclusion', criterion_text: 'Willing and able to provide written informed consent', is_mandatory: true, pass: true, failure_reason: '' },
                { criterion_id: 4, criterion_type: 'Exclusion', criterion_text: 'Current pregnancy or breastfeeding', is_mandatory: true, pass: true, failure_reason: '' },
                { criterion_id: 5, criterion_type: 'Exclusion', criterion_text: 'Participation in another clinical trial within the past 30 days', is_mandatory: true, pass: true, failure_reason: '' },
                { criterion_id: 6, criterion_type: 'Exclusion', criterion_text: 'Known hypersensitivity to study drug or excipients', is_mandatory: true, pass: true, failure_reason: '' },
            ]);
            return;
        }
        setCriteriaLoading(true);
        try {
            const data = await screeningAPI.getCriteria(user.site_id);
            if (data.criteria && data.criteria.length > 0) {
                setCriteria(data.criteria.map((c: Criterion) => ({
                    ...c,
                    pass: true,
                    failure_reason: '',
                })));
            } else {
                // Fallback to demo criteria if DB has none
                setCriteria([
                    { criterion_id: 1, criterion_type: 'Inclusion', criterion_text: 'Age 18–75 years at time of screening', is_mandatory: true, pass: true, failure_reason: '' },
                    { criterion_id: 2, criterion_type: 'Inclusion', criterion_text: 'Confirmed diagnosis per standard criteria', is_mandatory: true, pass: true, failure_reason: '' },
                    { criterion_id: 3, criterion_type: 'Inclusion', criterion_text: 'Willing and able to provide written informed consent', is_mandatory: true, pass: true, failure_reason: '' },
                    { criterion_id: 4, criterion_type: 'Exclusion', criterion_text: 'Current pregnancy or breastfeeding', is_mandatory: true, pass: true, failure_reason: '' },
                    { criterion_id: 5, criterion_type: 'Exclusion', criterion_text: 'Participation in another trial within 30 days', is_mandatory: true, pass: true, failure_reason: '' },
                ]);
            }
        } catch {
            setCriteria([
                { criterion_id: 1, criterion_type: 'Inclusion', criterion_text: 'Age 18–75 years at time of screening', is_mandatory: true, pass: true, failure_reason: '' },
                { criterion_id: 2, criterion_type: 'Exclusion', criterion_text: 'Current pregnancy or breastfeeding', is_mandatory: true, pass: true, failure_reason: '' },
            ]);
        } finally {
            setCriteriaLoading(false);
        }
    };

    const loadVersions = async () => {
        if (!user?.site_id) {
            setVersions([{ protocol_id: 1, version_number: '1.0', approval_date: '2024-01-01', valid_from: '2024-01-01' }]);
            setSelectedVersion('1.0');
            return;
        }
        setVersionsLoading(true);
        try {
            const data = await screeningAPI.getProtocolVersions(user.site_id);
            if (data.versions && data.versions.length > 0) {
                setVersions(data.versions);
                setSelectedVersion(data.versions[0].version_number);
            } else {
                setVersions([{ protocol_id: 1, version_number: '1.0', approval_date: today(), valid_from: today() }]);
                setSelectedVersion('1.0');
            }
        } catch {
            setVersions([{ protocol_id: 1, version_number: '1.0', approval_date: today(), valid_from: today() }]);
            setSelectedVersion('1.0');
        } finally {
            setVersionsLoading(false);
        }
    };

    // ─── Eligibility Score Calculation ─────────────────────────────
    const includedCriteria = criteria.filter(c => c.criterion_type === 'Inclusion');
    const excludedCriteria = criteria.filter(c => c.criterion_type === 'Exclusion');
    const passedInclusion = includedCriteria.filter(c => c.pass).length;
    const totalCriteria = criteria.length;
    const score = totalCriteria > 0
        ? Math.round(((passedInclusion + excludedCriteria.filter(c => c.pass).length) / totalCriteria) * 100)
        : 100;

    const failures = criteria.filter(c => !c.pass);
    const mandatoryFailures = failures.filter(c => c.is_mandatory);

    const verdict: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING' =
        mandatoryFailures.length === 0
            ? 'ELIGIBLE'
            : manualOverride
                ? 'PENDING'
                : 'INELIGIBLE';

    // ─── Step Validation ───────────────────────────────────────────
    const step1Valid = demographics.full_name.trim() && demographics.date_of_birth && demographics.gender;
    // Step 2 is valid once criteria are loaded — any verdict is submittable (screen failure is a valid outcome)
    const step2Valid = criteria.length > 0 && (
        verdict === 'ELIGIBLE' ||
        verdict === 'INELIGIBLE' ||
        (manualOverride && overrideReason.trim().length >= 20)
    );
    const step3Valid = selectedVersion && consentDate && eSignPassword.length >= 6;

    // ─── Criterion Toggle ──────────────────────────────────────────
    const toggleCriterion = (id: number, pass: boolean) => {
        setCriteria(prev => prev.map(c => c.criterion_id === id ? { ...c, pass } : c));
    };

    const setFailureReason = (id: number, reason: string) => {
        setCriteria(prev => prev.map(c => c.criterion_id === id ? { ...c, failure_reason: reason } : c));
    };

    // ─── Final Submit ──────────────────────────────────────────────
    const handleSubmit = async () => {
        setError(null);
        if (!step3Valid) return;
        setSubmitting(true);

        const screeningStatus = verdict === 'ELIGIBLE'
            ? 'Passed'
            : manualOverride
                ? 'Pending Review'
                : 'Failed';

        const failurePayload = failures.map(f => ({
            criterion_id: f.criterion_id,
            failure_reason: f.failure_reason,
            override_approved: manualOverride,
        }));

        try {
            const data = await screeningAPI.submit({
                full_name: demographics.full_name.trim(),
                date_of_birth: demographics.date_of_birth,
                gender: demographics.gender,
                site_id: user?.site_id ?? 1,
                screening_status: screeningStatus,
                eligibility_score: score,
                manual_override: manualOverride,
                override_reason: overrideReason,
                failures: failurePayload,
                consent_version: selectedVersion,
                consent_date: consentDate,
                e_signature_password: eSignPassword,
                submitted_by_user_id: user?.user_id ?? 0,
            });

            setResult(data);
            setSubmitted(true);
        } catch (err: any) {
            // Handle both axios response errors and network-level failures
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                (err?.message === 'Network Error' ? 'Cannot reach server. Please ensure the backend is running and try again.' : null) ||
                err?.message ||
                'Submission failed. Please try again.';
            setError(msg);
            console.error('Screening submit error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Verdict Styles Helper ─────────────────────────────────────
    const verdictClass = verdict === 'ELIGIBLE' ? 'verdict-eligible'
        : verdict === 'INELIGIBLE' ? 'verdict-ineligible'
            : 'verdict-pending';

    const scoreBannerClass = verdict === 'ELIGIBLE' ? 'score-eligible'
        : verdict === 'INELIGIBLE' ? 'score-ineligible'
            : 'score-pending';

    // ─────────────────────────────────────────────────────────────── 
    // RENDER
    // ─────────────────────────────────────────────────────────────── 

    if (submitted && result) {
        return (
            <div className="screening-container">
                <div className="screening-card">
                    <div className="success-screen">
                        <div className="success-icon">
                            <CheckCircle size={36} />
                        </div>
                        <h2>Screening Submitted Successfully</h2>
                        <p>
                            The patient has been recorded in the system. You can now proceed to randomization or track them in the Patient Registry.
                        </p>
                        <div className="success-meta-grid">
                            <span className="success-meta-key">Patient ID</span>
                            <span className="success-meta-val">{result.trial_patient_id}</span>
                            <span className="success-meta-key">Screening #</span>
                            <span className="success-meta-val">{result.screening_number}</span>
                            <span className="success-meta-key">Verdict</span>
                            <span className="success-meta-val" style={{ color: verdict === 'ELIGIBLE' ? 'var(--color-success)' : verdict === 'INELIGIBLE' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                {verdict === 'ELIGIBLE' ? 'PASSED' : verdict === 'INELIGIBLE' ? 'FAILED' : 'PENDING REVIEW'}
                            </span>
                            {result.consent_id && (
                                <>
                                    <span className="success-meta-key">Consent Recorded</span>
                                    <span className="success-meta-val" style={{ color: 'var(--color-success)' }}>✓ Version {selectedVersion}</span>
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-3)' }}>
                            <button className="btn-secondary" onClick={() => navigate('/patients')}>
                                View Registry
                            </button>
                            <button className="btn-primary" onClick={() => navigate(`/patients/${result.patient_id}`)}>
                                Open Patient Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="screening-container">
            {/* ── Page Header ─────────────────────────────────────── */}
            <div className="screening-page-header">
                <button className="back-btn" onClick={() => navigate('/patients')} aria-label="Back to registry">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1>New Patient Screening</h1>
                    <p>Complete all three steps to register and consent a new trial candidate.</p>
                </div>
            </div>

            {/* ── Step Progress Indicator ─────────────────────────── */}
            <div className="step-progress">
                {([
                    { num: 1, label: 'Demographics' },
                    { num: 2, label: 'Eligibility' },
                    { num: 3, label: 'Consent' },
                ] as { num: 1 | 2 | 3; label: string }[]).map(({ num, label }, i) => (
                    <React.Fragment key={num}>
                        <div className={`step-item ${step === num ? 'active' : step > num ? 'completed' : ''}`}>
                            <div className={`step-circle ${step === num ? 'active' : step > num ? 'completed' : ''}`}>
                                {step > num ? <Check size={14} /> : num}
                            </div>
                            <div className="step-meta">
                                <span className="step-num">Step {num}</span>
                                <span className="step-label">{label}</span>
                            </div>
                        </div>
                        {i < 2 && <div className={`step-connector ${step > num ? 'completed' : ''}`} />}
                    </React.Fragment>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                STEP 1 — DEMOGRAPHICS
            ══════════════════════════════════════════════════════ */}
            {step === 1 && (
                <div className="screening-card">
                    <div className="screening-card-header">
                        <div className="screening-card-icon"><User size={20} /></div>
                        <div>
                            <h2>Patient Demographics</h2>
                            <p>Enter the candidate's basic information. A screening number will be auto-generated.</p>
                        </div>
                    </div>
                    <div className="screening-card-body">
                        <div className="form-group">
                            <label className="form-label">Full Name <span className="required">*</span></label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Jane Doe"
                                value={demographics.full_name}
                                onChange={e => setDemographics(p => ({ ...p, full_name: e.target.value }))}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Date of Birth <span className="required">*</span></label>
                                <input
                                    type="date"
                                    className="form-input"
                                    max={today()}
                                    value={demographics.date_of_birth}
                                    onChange={e => setDemographics(p => ({ ...p, date_of_birth: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender <span className="required">*</span></label>
                                <select
                                    className="form-select"
                                    value={demographics.gender}
                                    onChange={e => setDemographics(p => ({ ...p, gender: e.target.value }))}
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other / Prefer not to say</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Screening Number</label>
                            <input
                                type="text"
                                className="form-input"
                                value="Auto-generated on submission"
                                disabled
                                style={{ color: 'var(--gray-400)', background: 'var(--gray-50)' }}
                            />
                            <p className="form-hint">Format: SCR-YYYYMMDD-XXXX — assigned automatically.</p>
                        </div>
                        <div className="form-actions">
                            <button className="btn-primary" disabled={!step1Valid} onClick={() => setStep(2)}>
                                Next: Eligibility Checklist <ArrowRight size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STEP 2 — ELIGIBILITY CHECKLIST
            ══════════════════════════════════════════════════════ */}
            {step === 2 && (
                <div className="screening-card">
                    <div className="screening-card-header">
                        <div className="screening-card-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                            <ClipboardList size={20} />
                        </div>
                        <div>
                            <h2>Eligibility Checklist</h2>
                            <p>Review all inclusion and exclusion criteria. Score updates live.</p>
                        </div>
                    </div>
                    <div className="screening-card-body">
                        {criteriaLoading ? (
                            <div className="loading-spinner">
                                <RefreshCw size={28} className="animate-spin" />
                                <span>Loading eligibility criteria…</span>
                            </div>
                        ) : (
                            <>
                                {/* Score Banner */}
                                <div className={`eligibility-score-banner ${scoreBannerClass}`}>
                                    <div>
                                        <div className="score-label">Eligibility Score</div>
                                        <div className="score-value" style={{ color: verdict === 'ELIGIBLE' ? 'var(--color-success)' : verdict === 'INELIGIBLE' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                            {score}%
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginBottom: 6 }}>
                                            {failures.length} of {totalCriteria} criteria unmet
                                        </div>
                                        <span className={`verdict-badge ${verdictClass}`}>{verdict}</span>
                                    </div>
                                </div>

                                {/* Inclusion Criteria */}
                                {includedCriteria.length > 0 && (
                                    <>
                                        <div className="criteria-section-title inclusion-title">
                                            <CheckCircle size={14} /> Inclusion Criteria ({passedInclusion}/{includedCriteria.length} met)
                                        </div>
                                        {includedCriteria.map(c => (
                                            <div key={c.criterion_id} className={`criterion-card ${c.pass ? 'pass' : 'fail'}`}>
                                                <div className="criterion-check">
                                                    <button className={`toggle-pass ${c.pass ? 'active' : ''}`} onClick={() => toggleCriterion(c.criterion_id, true)}>✓</button>
                                                    <button className={`toggle-fail ${!c.pass ? 'active' : ''}`} onClick={() => toggleCriterion(c.criterion_id, false)}>✗</button>
                                                </div>
                                                <div className="criterion-body">
                                                    <p className="criterion-text">{c.criterion_text}</p>
                                                    {c.is_mandatory && <span className="criterion-mandatory">● Mandatory</span>}
                                                    {!c.pass && (
                                                        <div className="criterion-failure-note">
                                                            <textarea
                                                                rows={2}
                                                                placeholder="Reason for failure (optional but recommended)…"
                                                                value={c.failure_reason}
                                                                onChange={e => setFailureReason(c.criterion_id, e.target.value)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Exclusion Criteria */}
                                {excludedCriteria.length > 0 && (
                                    <>
                                        <div className="criteria-section-title exclusion-title" style={{ marginTop: 'var(--spacing-6)' }}>
                                            <AlertCircle size={14} /> Exclusion Criteria ({excludedCriteria.filter(c => c.pass).length}/{excludedCriteria.length} cleared)
                                        </div>
                                        {excludedCriteria.map(c => (
                                            <div key={c.criterion_id} className={`criterion-card ${c.pass ? 'pass' : 'fail'}`}>
                                                <div className="criterion-check">
                                                    <button className={`toggle-pass ${c.pass ? 'active' : ''}`} title="Not present / Cleared" onClick={() => toggleCriterion(c.criterion_id, true)}>✓</button>
                                                    <button className={`toggle-fail ${!c.pass ? 'active' : ''}`} title="Present — patient excluded" onClick={() => toggleCriterion(c.criterion_id, false)}>✗</button>
                                                </div>
                                                <div className="criterion-body">
                                                    <p className="criterion-text">{c.criterion_text}</p>
                                                    {c.is_mandatory && <span className="criterion-mandatory">● Mandatory exclusion</span>}
                                                    {!c.pass && (
                                                        <div className="criterion-failure-note">
                                                            <textarea
                                                                rows={2}
                                                                placeholder="Additional notes…"
                                                                value={c.failure_reason}
                                                                onChange={e => setFailureReason(c.criterion_id, e.target.value)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Manual Override */}
                                {mandatoryFailures.length > 0 && (
                                    <div style={{ marginTop: 'var(--spacing-6)' }}>
                                        <div className="override-toggle-row">
                                            <div>
                                                <div className="override-toggle-label">
                                                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                                                    Manual Override (PI Discretion)
                                                </div>
                                                <div className="override-toggle-desc">
                                                    Enable only for borderline cases where the PI determines eligibility. Requires written justification of ≥20 characters.
                                                    {user?.role === 'Study Coordinator' && (
                                                        <div className="text-red-500 mt-1 font-medium">⚠️ PI Approval Required — Coordinators cannot override.</div>
                                                    )}
                                                </div>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={manualOverride}
                                                    onChange={e => setManualOverride(e.target.checked)}
                                                    disabled={user?.role === 'Study Coordinator'}
                                                    title={user?.role === 'Study Coordinator' ? 'Only the Principal Investigator can manually override eligibility.' : ''}
                                                />
                                                <span className={`toggle-slider ${user?.role === 'Study Coordinator' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                            </label>
                                        </div>
                                        {manualOverride && (
                                            <div className="form-group">
                                                <label className="form-label">Override Justification <span className="required">*</span></label>
                                                <textarea
                                                    className="form-textarea"
                                                    rows={4}
                                                    placeholder="Provide clinical justification for allowing this patient to proceed despite unmet criteria…"
                                                    value={overrideReason}
                                                    onChange={e => setOverrideReason(e.target.value)}
                                                />
                                                <p className="form-hint">{overrideReason.length}/20 characters minimum</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="form-actions">
                                    <button className="btn-secondary" onClick={() => setStep(1)}>
                                        <ArrowLeft size={15} /> Back
                                    </button>
                                    <button className="btn-primary" disabled={!step2Valid} onClick={() => setStep(3)}>
                                        Next: Consent Recording <ArrowRight size={15} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STEP 3 — CONSENT RECORDING
            ══════════════════════════════════════════════════════ */}
            {step === 3 && (
                <div className="screening-card">
                    <div className="screening-card-header">
                        <div className="screening-card-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2>Informed Consent Recording</h2>
                            <p>Record which protocol version was consented to, in compliance with 21 CFR Part 11.</p>
                        </div>
                    </div>
                    <div className="screening-card-body">
                        {error && (
                            <div className="screening-error">
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* 21 CFR Part 11 Notice */}
                        <div className="esig-warning">
                            <Shield size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>
                                <strong>21 CFR Part 11 E-Signature Required.</strong> By entering your password below, you are legally attesting that this informed consent process was performed in compliance with GCP guidelines and that the patient voluntarily agreed to participate after receiving adequate information.
                            </span>
                        </div>

                        {/* Protocol Version */}
                        <div className="form-group">
                            <label className="form-label">Consent Protocol Version <span className="required">*</span></label>
                            {versionsLoading ? (
                                <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>Loading versions…</div>
                            ) : versions.length > 0 ? (
                                versions.map(v => (
                                    <div
                                        key={v.protocol_id}
                                        className={`consent-version-option ${selectedVersion === v.version_number ? 'selected' : ''}`}
                                        onClick={() => setSelectedVersion(v.version_number)}
                                    >
                                        <div className={`consent-radio ${selectedVersion === v.version_number ? 'selected' : ''}`} />
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>Version {v.version_number}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                Approved: {new Date(v.approval_date).toLocaleDateString()} · Valid from: {new Date(v.valid_from).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: 'var(--spacing-3)', color: 'var(--gray-400)', fontSize: '0.875rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                                    No protocol versions found. Using default v1.0.
                                </div>
                            )}
                        </div>

                        {/* Consent Date */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Consent Date <span className="required">*</span></label>
                                <input
                                    type="date"
                                    className="form-input"
                                    max={today()}
                                    value={consentDate}
                                    onChange={e => setConsentDate(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Patient Verdict</label>
                                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className={`verdict-badge ${verdictClass}`} style={{ fontSize: '0.75rem' }}>{verdict}</span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                                        {verdict === 'ELIGIBLE' ? 'All criteria met' : verdict === 'INELIGIBLE' ? 'Criteria not met' : 'Manual override active — PI review required'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* E-Signature / Password */}
                        <div className="form-group">
                            <label className="form-label">
                                <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
                                E-Signature — Password Re-Entry <span className="required">*</span>
                            </label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Re-enter your account password to sign"
                                value={eSignPassword}
                                onChange={e => setESignPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <p className="form-hint">Minimum 6 characters. A SHA-256 hash of your signature will be recorded in the audit trail.</p>
                        </div>

                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setStep(2)}>
                                <ArrowLeft size={15} /> Back
                            </button>
                            <button
                                className="btn-primary"
                                disabled={!step3Valid || submitting}
                                onClick={handleSubmit}
                            >
                                {submitting ? (
                                    <><RefreshCw size={14} className="animate-spin" /> Submitting…</>
                                ) : (
                                    <><CheckCircle size={14} /> Submit Screening & Consent</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

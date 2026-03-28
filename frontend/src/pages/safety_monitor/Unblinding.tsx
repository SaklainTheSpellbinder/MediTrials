import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, Lock, Search, AlertTriangle, CheckCircle, Printer } from 'lucide-react';
import '../Dashboard.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

const JUSTIFICATIONS = ['Emergency Medical Necessity', 'Regulatory Requirement', 'Patient Safety', 'Other'];

export const Unblinding: React.FC = () => {
    const { user } = useAuth();

    // PIN gate state
    const [pinVerified, setPinVerified] = useState(false);
    const [pinPassword, setPinPassword] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);

    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');

    // Form state
    const [reason, setReason] = useState('');
    const [justification, setJustification] = useState(JUSTIFICATIONS[0]);
    const [physician, setPhysician] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [formMsg, setFormMsg] = useState('');

    // PIN verification
    const handlePinVerify = async () => {
        setPinLoading(true); setPinError('');
        try {
            const r = await safetyApi.post('/api/safety/verify-password', { password: pinPassword });
            if (r.data.verified) {
                setPinVerified(true);
            } else {
                setPinError('Incorrect password. Please try again.');
            }
        } catch {
            setPinError('Verification failed. Please try again.');
        } finally {
            setPinLoading(false);
        }
    };

    // Patient lookup
    const { data: patientData, isLoading: patientLoading } = useQuery({
        queryKey: ['unblinding-patient', searchTerm],
        queryFn: () => safetyApi.get(`/api/safety/unblinding/${searchTerm}`).then(r => r.data),
        enabled: !!searchTerm,
    });

    const unblindMut = useMutation({
        mutationFn: async () => {
            const vr = await safetyApi.post('/api/safety/verify-password', { password: confirmPassword });
            if (!vr.data.verified) throw new Error('Password verification failed');
            return safetyApi.post('/api/safety/unblind', {
                patient_id: patientData?.patient?.patient_id,
                reason, justification_category: justification, requesting_physician: physician,
            });
        },
        onSuccess: (r) => { setResult(r.data.result); setShowConfirmModal(false); },
        onError: (e: any) => { setFormMsg(e.message); },
    });

    // ── PIN Gate ──────────────────────────────────────────────────────────────
    if (!pinVerified) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
                <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', padding: '3rem 2.5rem', width: 400, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Lock size={28} color="#DC2626" />
                    </div>
                    <h2 style={{ margin: '0 0 8px', fontWeight: 800 }}>Identity Verification</h2>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '2rem' }}>
                        Confirm your identity to access Emergency Unblinding.<br />This action is strictly logged under 21 CFR Part 11.
                    </p>
                    <div style={{ textAlign: 'left', marginBottom: 16 }}>
                        <label className="form-label">Your Password</label>
                        <input className="form-input" type="password" value={pinPassword}
                            onChange={e => setPinPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePinVerify()}
                            placeholder="Enter your account password" />
                    </div>
                    {pinError && <p style={{ color: '#DC2626', fontSize: '0.875rem', marginBottom: 12 }}>{pinError}</p>}
                    <button className="btn-primary" style={{ width: '100%', padding: '12px' }}
                        disabled={!pinPassword || pinLoading} onClick={handlePinVerify}>
                        {pinLoading ? 'Verifying…' : 'Verify Identity'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Result screen ─────────────────────────────────────────────────────────
    if (result) {
        return (
            <div className="dashboard-container">
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <CheckCircle size={56} color="#10B981" style={{ marginBottom: 16 }} />
                        <h2 style={{ margin: '0 0 8px', fontWeight: 800 }}>Unblinding Successful</h2>
                        <p style={{ color: 'var(--gray-500)', marginBottom: '2rem' }}>
                            Patient {patientData?.patient?.trial_patient_id} has been unblinded. This action is permanently recorded.
                        </p>
                        <div style={{ background: '#1E293B', color: 'white', borderRadius: 12, padding: '2rem', marginBottom: '1.5rem' }}>
                            <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Treatment Assignment</p>
                            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '0.05em' }}>{result.arm_code}</p>
                            {result.arm_name && <p style={{ margin: '8px 0 0', color: '#CBD5E1', fontSize: '0.875rem' }}>{result.arm_name}</p>}
                            {result.arm_description && <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.8rem' }}>{result.arm_description}</p>}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                            Unblinded at: {result.unblinded_at?.split('T')[0] ?? new Date().toISOString().split('T')[0]} · By: {user?.full_name}
                        </p>
                        <button className="btn-secondary" onClick={window.print} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Printer size={15} /> Print Record
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const patient = patientData?.patient;
    const isUnblinded = patient?.is_unblinded;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldAlert size={22} color="#DC2626" /> Emergency Unblinding
                    </h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Identity verified · All actions permanently logged · 21 CFR compliant</p>
                </div>
            </div>

            {/* Patient search */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <label className="form-label">Search Patient by ID</label>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input className="form-input" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && setSearchTerm(searchInput)}
                        placeholder="e.g. PT-2024-001 or patient ID" style={{ flex: 1 }} />
                    <button className="btn-primary" onClick={() => setSearchTerm(searchInput)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Search size={15} /> Search
                    </button>
                </div>
            </div>

            {/* Patient card */}
            {patientLoading && <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>Searching…</div>}
            {patient && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <h3 className="card-title">{patient.trial_patient_id}</h3>
                        <span style={{
                            background: isUnblinded ? '#ECFDF5' : '#FEF2F2',
                            color: isUnblinded ? '#059669' : '#DC2626',
                            padding: '4px 12px', borderRadius: 9999, fontWeight: 700, fontSize: '0.8rem',
                        }}>{isUnblinded ? '🔓 Unblinded' : '🔒 Blinded'}</span>
                    </div>
                    <div style={{ padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <Field label="Site" value={patient.institution_name} />
                        <Field label="Status" value={patient.patient_status} />
                        <Field label="Enrolled" value={patient.enrollment_date?.split('T')[0]} />
                    </div>
                    {isUnblinded && (
                        <div style={{ padding: '1rem 1.5rem', background: '#ECFDF5', borderTop: '1px solid #D1FAE5' }}>
                            <p style={{ margin: 0, color: '#059669', fontWeight: 600 }}>
                                Already unblinded: Arm <strong>{patient.arm_code}</strong> · {patient.unblinded_at?.split('T')[0]}
                            </p>
                        </div>
                    )}

                    {/* Previous unblinding history */}
                    {(patientData?.history ?? []).length > 0 && (
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--gray-100)' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Unblinding History</p>
                            {patientData.history.map((h: any, i: number) => (
                                <p key={i} style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                                    {h.changed_at?.split('T')[0]} · {h.change_reason}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Unblinding form — only if patient found and NOT already unblinded */}
            {patient && !isUnblinded && (
                <div className="card">
                    {/* Warning */}
                    <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '1rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#DC2626' }}>This action is irreversible</p>
                            <p style={{ margin: '3px 0 0', fontSize: '0.875rem', color: '#7F1D1D' }}>
                                Unblinding will be permanently recorded in the audit trail and will trigger an automatic safety alert.
                            </p>
                        </div>
                    </div>

                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="form-label">Justification Category</label>
                            <select className="form-select" value={justification} onChange={e => setJustification(e.target.value)}>
                                {JUSTIFICATIONS.map(j => <option key={j}>{j}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">
                                Reason for Unblinding <span style={{ color: '#DC2626' }}>*</span>
                                <span style={{ float: 'right', color: reason.length < 100 ? '#DC2626' : '#10B981' }}>{reason.length}/100 min</span>
                            </label>
                            <textarea className="ack-textarea" rows={5} value={reason} onChange={e => setReason(e.target.value)}
                                placeholder="Provide detailed clinical justification (minimum 100 characters)…" />
                        </div>
                        <div>
                            <label className="form-label">Requesting Physician Name</label>
                            <input className="form-input" value={physician} onChange={e => setPhysician(e.target.value)} placeholder="Dr. Full Name" />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.875rem' }}>
                            <input type="checkbox" style={{ marginTop: 3, width: 16, height: 16 }} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                            I confirm this unblinding is medically necessary and I accept full clinical responsibility for this action.
                        </label>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                            <button className="btn-primary"
                                style={{ background: '#DC2626' }}
                                disabled={reason.length < 100 || !confirmed}
                                onClick={() => setShowConfirmModal(true)}>
                                Proceed to Unblind Patient
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Final confirmation modal */}
            {showConfirmModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 12, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ background: '#FEF2F2', padding: '1.5rem', borderRadius: '12px 12px 0 0', textAlign: 'center' }}>
                            <AlertTriangle size={36} color="#DC2626" />
                            <h3 style={{ margin: '12px 0 6px', color: '#DC2626' }}>Final Confirmation</h3>
                            <p style={{ margin: 0, color: '#7F1D1D', fontSize: '0.875rem' }}>This will create a permanent safety alert and cannot be reversed.</p>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                                <strong>Patient:</strong> {patient?.trial_patient_id}<br />
                                <strong>Justification:</strong> {justification}
                            </p>
                            <div>
                                <label className="form-label">Confirm Password (Second Authentication) <span style={{ color: '#DC2626' }}>*</span></label>
                                <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            </div>
                            {formMsg && <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{formMsg}</p>}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn-secondary" onClick={() => setShowConfirmModal(false)}>Cancel</button>
                                <button style={{ background: '#DC2626', color: 'white', padding: '8px 20px', borderRadius: 6, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                                    disabled={!confirmPassword || unblindMut.isPending} onClick={() => unblindMut.mutate()}>
                                    {unblindMut.isPending ? 'Processing…' : 'Confirm Unblinding'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <p style={{ margin: '0 0 2px', fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{value ?? '—'}</p>
    </div>
);

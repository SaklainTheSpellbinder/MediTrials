import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AEGradeBadge } from '../../components/safety/AEGradeBadge';
import { Clock, FileWarning, AlertCircle, CheckCircle, ChevronRight, X } from 'lucide-react';
import '../Dashboard.css';
import { safetyManagerAPI } from '../../services/api';

// --- Type Interfaces ---
export interface SAETabCount {
    sae_status: string;
    cnt: string | number;
}

export interface SAEData {
    sae_id: number;
    sae_report_number: string;
    ae_term: string;
    trial_patient_id: string;
    site_name: string;
    severity_grade: number;
    causality_relationship?: string;
    results_in_death: boolean;
    life_threatening: boolean;
    requires_hospitalization: boolean;
    ae_start_date?: string;
    sae_status: string;
    report_deadline_date?: string;
    days_overdue?: number | string;
    hours_until_deadline?: number | string;
    narrative_text?: string;
    fda_submitted_date?: string;
    ema_submitted_date?: string;
    irb_submitted_date?: string;
    dsmb_review_date?: string;
}

export interface SAEListResponse {
    saes: SAEData[];
    tabCounts: SAETabCount[];
}
// ------------------------

const STATUSES = ['Open', 'Under Investigation', 'Reported', 'Closed'];

const deadlineBg = (days: number, hours: number) => {
    if (days > 0) return '#FEE2E2'; // overdue
    if (hours < 72) return '#FFFBEB';
    return 'transparent';
};
const deadlineColor = (days: number, hours: number) => {
    if (days > 0) return '#DC2626';
    if (hours < 72) return '#F59E0B';
    if (hours < 168) return '#10B981';
    return '#6B7280';
};

const DeadlineBadge: React.FC<{ days_overdue: number | string; hours: number | string }> = ({ days_overdue, hours }) => {
    const daysOver = typeof days_overdue === 'string' ? parseFloat(days_overdue) : (days_overdue || 0);
    const hoursLeft = typeof hours === 'string' ? parseFloat(hours) : (hours || 0);
    const color = deadlineColor(daysOver, hoursLeft);
    const label = daysOver > 0
        ? `${Math.round(daysOver)}d OVERDUE`
        : `${Math.round(hoursLeft)}h left`;
    return (
        <span style={{ color, fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{label}</span>
    );
};

const StatusStepper: React.FC<{ current: string }> = ({ current }) => {
    const idx = STATUSES.indexOf(current);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.5rem' }}>
            {STATUSES.map((s, i) => (
                <React.Fragment key={s}>
                    <div style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                        background: i === idx ? '#2563EB' : i < idx ? '#DBEAFE' : '#F3F4F6',
                        color: i === idx ? 'white' : i < idx ? '#1D4ED8' : '#9CA3AF',
                        border: i === idx ? '2px solid #2563EB' : '2px solid transparent',
                    }}>{s}</div>
                    {i < STATUSES.length - 1 && <div style={{ width: 32, height: 2, background: i < idx ? '#2563EB' : '#E5E7EB' }} />}
                </React.Fragment>
            ))}
        </div>
    );
};

const SAEDetailModal: React.FC<{ saeId: number; onClose: () => void }> = ({ saeId, onClose }) => {
    const qc = useQueryClient();
    const { user } = useAuth();
    const [reason, setReason] = useState('');
    const [password, setPassword] = useState('');
    const [narrative, setNarrative] = useState('');
    const [msg, setMsg] = useState('');

    const { data: sae, isLoading } = useQuery<SAEData>({
        queryKey: ['sae-detail', saeId],
        queryFn: () => safetyManagerAPI.getSaeById(saeId),
    });

    // Replace the old onSuccess with a useEffect hook
    useEffect(() => {
        if (sae) {
            setNarrative(sae.narrative_text ?? '');
        }
    }, [sae]);

    const updateMut = useMutation({
        mutationFn: async (body: Partial<SAEData> & { reason?: string }) => {
            const vr = await safetyManagerAPI.verifyPassword(password);
            if (!vr.data?.verified) throw new Error('Password verification failed');
            return safetyManagerAPI.updateSae(saeId, { ...body, reason });
        },
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['sae-list'] }); 
            qc.invalidateQueries({ queryKey: ['sae-detail', saeId] }); 
            setMsg('Saved ✓'); 
            setTimeout(() => setMsg(''), 3000); 
        },
        onError: (e: any) => setMsg(e.message),
    });

    if (isLoading) return (
        <div style={modalBackdrop}>
            <div style={modalBox}><div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div></div>
        </div>
    );
    if (!sae) return null;

    const dayZero = sae.ae_start_date?.split('T')[0] ?? null;
    const today = new Date().toISOString().split('T')[0];

    return (
        <div style={modalBackdrop} onClick={onClose}>
            <div style={{ ...modalBox, width: 720, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontWeight: 700 }}>{sae.sae_report_number}</h3>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.8rem' }}>{sae.ae_term} · {sae.trial_patient_id} · {sae.site_name}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <StatusStepper current={sae.sae_status} />

                    {/* Regulatory Timeline */}
                    <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '1rem' }}>
                        <h4 style={sh}>Regulatory Timeline</h4>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {[
                                { label: 'Day 0 — Event', date: dayZero },
                                { label: 'Day 3 — Initial Report Due', date: getOffset(dayZero, 3) },
                                { label: 'Day 15 — Follow-up Due', date: getOffset(dayZero, 15) },
                            ].map(item => {
                                const isPast = item.date && item.date <= today;
                                return (
                                    <div key={item.label} style={{
                                        padding: '8px 12px', borderRadius: 6, border: `2px solid ${isPast ? '#10B981' : '#E5E7EB'}`,
                                        background: isPast ? '#ECFDF5' : 'white', fontSize: '0.78rem',
                                    }}>
                                        <p style={{ margin: '0 0 2px', fontWeight: 700, color: isPast ? '#059669' : '#6B7280' }}>{item.label}</p>
                                        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{item.date ?? '—'}</p>
                                        {isPast && <p style={{ margin: '2px 0 0', color: '#10B981', fontSize: '0.7rem' }}>✓ Passed</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Linked AE & flags */}
                    <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '1rem' }}>
                        <h4 style={sh}>Linked AE Details</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <Field label="AE Term" value={sae.ae_term} />
                            <Field label="Grade"><AEGradeBadge grade={sae.severity_grade} /></Field>
                            <Field label="Causality" value={sae.causality_relationship} />
                            <Field label="Death" value={sae.results_in_death ? '✓ YES' : 'No'} />
                            <Field label="Life Threatening" value={sae.life_threatening ? '✓ YES' : 'No'} />
                            <Field label="Hospitalization" value={sae.requires_hospitalization ? '✓ YES' : 'No'} />
                        </div>
                    </div>

                    {/* Report submission section */}
                    <div>
                        <h4 style={sh}>Report Submission</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <label className="form-label">FDA Submitted Date</label>
                                <input className="form-input" type="date" defaultValue={sae.fda_submitted_date?.split('T')[0]} id={`fda-${saeId}`} />
                            </div>
                            <div>
                                <label className="form-label">EMA Submitted Date</label>
                                <input className="form-input" type="date" defaultValue={sae.ema_submitted_date?.split('T')[0]} id={`ema-${saeId}`} />
                            </div>
                            <div>
                                <label className="form-label">Local IRB Submitted Date</label>
                                <input className="form-input" type="date" defaultValue={sae.irb_submitted_date?.split('T')[0]} id={`irb-${saeId}`} />
                            </div>
                            <div>
                                <label className="form-label">DSMB Review Date</label>
                                <input className="form-input" type="date" defaultValue={sae.dsmb_review_date?.split('T')[0]} id={`dsmb-${saeId}`} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label className="form-label">Regulatory Narrative <span style={{ color: '#DC2626' }}>*</span></label>
                            <textarea className="ack-textarea" rows={5} value={narrative} onChange={e => setNarrative(e.target.value)}
                                placeholder="Full narrative for regulatory submission…" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                                <label className="form-label">Reason for Change <span style={{ color: '#DC2626' }}>*</span></label>
                                <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Audit trail reason" />
                            </div>
                            <div>
                                <label className="form-label">Confirm Password <span style={{ color: '#DC2626' }}>*</span></label>
                                <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                        </div>
                        {msg && <p style={{ color: msg.includes('✓') ? '#10B981' : '#DC2626', fontSize: '0.8rem', marginBottom: 12 }}>{msg}</p>}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {sae.sae_status === 'Open' && (
                                <button className="btn-secondary" disabled={!reason || !password || updateMut.isPending}
                                    onClick={() => updateMut.mutate({ sae_status: 'Under Investigation', narrative_text: narrative })}>
                                    Mark Under Investigation
                                </button>
                            )}
                            {['Open', 'Under Investigation'].includes(sae.sae_status) && (
                                <button className="btn-primary" disabled={!narrative || !reason || !password || updateMut.isPending}
                                    onClick={() => updateMut.mutate({
                                        sae_status: 'Reported',
                                        report_deadline_date: today, // Assuming submitted maps here loosely, adjust if needed
                                        narrative_text: narrative,
                                        fda_submitted_date: (document.getElementById(`fda-${saeId}`) as HTMLInputElement)?.value || undefined,
                                        ema_submitted_date: (document.getElementById(`ema-${saeId}`) as HTMLInputElement)?.value || undefined,
                                        irb_submitted_date: (document.getElementById(`irb-${saeId}`) as HTMLInputElement)?.value || undefined,
                                        dsmb_review_date: (document.getElementById(`dsmb-${saeId}`) as HTMLInputElement)?.value || undefined,
                                    })}>
                                    {updateMut.isPending ? 'Submitting…' : 'Submit Report'}
                                </button>
                            )}
                            {sae.sae_status === 'Reported' && (
                                <button style={{ background: '#6B7280', color: 'white', padding: '8px 16px', borderRadius: 6, fontWeight: 500 }}
                                    disabled={!reason || !password || updateMut.isPending}
                                    onClick={() => updateMut.mutate({ sae_status: 'Closed', narrative_text: narrative })}>
                                    Close SAE
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function getOffset(startDate: string | null, days: number): string | null {
    if (!startDate) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalBox: React.CSSProperties = { background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '90%', maxWidth: 720 };
const sh: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' };

const Field: React.FC<{ label: string; value?: string | number; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p style={{ margin: '0 0 2px', fontSize: '0.7rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>{label}</p>
        {children ?? <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>{value ?? '—'}</p>}
    </div>
);

export const SAEManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('');
    const [selectedSaeId, setSelectedSaeId] = useState<number | null>(null);

    const { data, isLoading } = useQuery<SAEListResponse>({
        queryKey: ['sae-list', activeTab],
        queryFn: () => safetyManagerAPI.getSaes({ params: { sae_status: activeTab || undefined } }),
    });

    const saes = data?.saes ?? [];
    const tabCounts: Record<string, number> = {};
    
    (data?.tabCounts ?? []).forEach((r) => { 
        tabCounts[r.sae_status] = typeof r.cnt === 'string' ? parseInt(r.cnt) : r.cnt; 
    });
    
    const totalCount = Object.values(tabCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">SAE Management</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Serious Adverse Events — regulatory reporting workflow</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '2px solid var(--gray-200)', paddingBottom: '0' }}>
                {[{ key: '', label: 'All' }, ...STATUSES.map(s => ({ key: s, label: s }))].map(tab => (
                    <button key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 18px 12px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                            borderBottom: activeTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                            color: activeTab === tab.key ? '#2563EB' : 'var(--gray-500)',
                            background: 'none', marginBottom: -2,
                        }}>
                        {tab.label}
                        <span style={{
                            marginLeft: 6, background: tab.key === '' ? '#E5E7EB' : activeTab === tab.key ? '#DBEAFE' : '#F3F4F6',
                            color: activeTab === tab.key ? '#2563EB' : '#6B7280',
                            padding: '1px 7px', borderRadius: 9999, fontSize: '0.72rem'
                        }}>
                            {tab.key === '' ? totalCount : (tabCounts[tab.key] ?? 0)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="card">
                {isLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading SAEs…</div>
                ) : saes.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                        <CheckCircle size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <p>No SAEs in this category.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="sm-table">
                            <thead>
                                <tr>
                                    <th>SAE Report #</th><th>Linked AE</th><th>Patient</th><th>Site</th>
                                    <th>Grade</th><th>Flags</th><th>Deadline</th><th>Time Left</th>
                                    <th>Status</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {saes.map((sae) => {
                                    const daysOver = typeof sae.days_overdue === 'string' ? parseFloat(sae.days_overdue) : (sae.days_overdue || 0);
                                    const hoursLeft = typeof sae.hours_until_deadline === 'string' ? parseFloat(sae.hours_until_deadline) : (sae.hours_until_deadline || 0);
                                    return (
                                        <tr key={sae.sae_id}
                                            style={{ background: deadlineBg(daysOver, hoursLeft), cursor: 'pointer' }}
                                            onClick={() => setSelectedSaeId(sae.sae_id)}>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>{sae.sae_report_number}</td>
                                            <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{sae.ae_term}</td>
                                            <td>{sae.trial_patient_id}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{sae.site_name}</td>
                                            <td><AEGradeBadge grade={sae.severity_grade} /></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {sae.results_in_death && <span title="Death" style={{ fontSize: '1rem' }}>💀</span>}
                                                    {sae.life_threatening && <span title="Life-threatening" style={{ fontSize: '1rem' }}>⚠️</span>}
                                                    {sae.requires_hospitalization && <span title="Hospitalization" style={{ fontSize: '1rem' }}>🏥</span>}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '0.78rem' }}>{sae.report_deadline_date?.split('T')[0] ?? '—'}</td>
                                            <td><DeadlineBadge days_overdue={daysOver} hours={hoursLeft} /></td>
                                            <td>
                                                <span style={{
                                                    background: { 'Open': '#FEE2E2', 'Under Investigation': '#FFFBEB', 'Reported': '#ECFDF5', 'Closed': '#F3F4F6' }[sae.sae_status] ?? '#F3F4F6',
                                                    color: { 'Open': '#991B1B', 'Under Investigation': '#854D0E', 'Reported': '#065F46', 'Closed': '#6B7280' }[sae.sae_status] ?? '#6B7280',
                                                    padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600,
                                                }}>{sae.sae_status}</span>
                                            </td>
                                            <td><ChevronRight size={14} color="var(--gray-400)" /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedSaeId && <SAEDetailModal saeId={selectedSaeId} onClose={() => setSelectedSaeId(null)} />}
        </div>
    );
};
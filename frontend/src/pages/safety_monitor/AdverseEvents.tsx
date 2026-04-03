import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { SeverityBadge } from '../../components/safety/SeverityBadge';
import { AEGradeBadge } from '../../components/safety/AEGradeBadge';
import { X, Download, AlertCircle, ChevronRight } from 'lucide-react';
import '../Dashboard.css';
import { safetyManagerAPI } from '../../services/api';


const CAUSALITY_OPTIONS = ['Definite', 'Probable', 'Possible', 'Unlikely', 'Unrelated'];
const OUTCOME_OPTIONS = ['Recovered', 'Recovering', 'Not Recovered', 'Fatal', 'Unknown'];

// Add this below OUTCOME_OPTIONS

export interface AdverseEventData {
    ae_id: number;
    ae_term: string;
    trial_patient_id: string;
    site_name: string;
    ae_start_date?: string;
    severity_grade: number;
    status: string;
    treatment_related: boolean;
    results_in_death: boolean;
    life_threatening: boolean;
    requires_hospitalization: boolean;
    sae_report_number?: string;
    sae_status?: string;
    report_deadline_date?: string;
    report_submitted_date?: string;
    causality_relationship?: string;
    outcome?: string;
    reason?: string;
    relatedAlerts?: Array<{
        alert_id: number;
        alert_severity: string;
        alert_message: string;
        created_at: string;
    }>;
}

const AEDetailPanel: React.FC<{ aeId: number; onClose: () => void }> = ({ aeId, onClose }) => {
    const qc = useQueryClient();
    const { user } = useAuth();
    const [causality, setCausality] = useState('');
    const [outcome, setOutcome] = useState('');
    const [reason, setReason] = useState('');
    const [password, setPassword] = useState('');
    const [saveMsg, setSaveMsg] = useState('');

    const { data: ae, isLoading } = useQuery<AdverseEventData>({
    queryKey: ['ae-detail', aeId],
    queryFn: async () => {
        return await safetyManagerAPI.getAeById(aeId);
    }
}); 

// Use a standard React effect to update your editable state 
// once the 'ae' data successfully loads from the query.
useEffect(() => {
    if (ae) {
        setCausality(ae.causality_relationship ?? '');
        setOutcome(ae.outcome ?? '');
    }
}, [ae]);

    const updateMut = useMutation({
        mutationFn: async () => {
            // Verify password (21 CFR Part 11)
            const vr = await safetyManagerAPI.verifyPassword(password);
            if (!vr.data.verified) throw new Error('Password verification failed');
            return safetyManagerAPI.updateAe(aeId, { causality_relationship: causality, outcome, reason });
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['ae-list'] }); setSaveMsg('Saved successfully ✓'); setTimeout(() => setSaveMsg(''), 3000); },
        onError: (e: any) => setSaveMsg(e.message),
    });

    if (isLoading) return <div style={panelStyle}><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div></div>;
    if (!ae) return null;

    const isSAE = !!ae.sae_report_number;

    return (
        <div style={panelStyle}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{ae.ae_term}</h3>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.8rem' }}>AE #{ae.ae_id} · {ae.trial_patient_id}</p>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Core details */}
                <div style={sectionStyle}>
                    <div style={fieldGrid}>
                        <Field label="Site" value={ae.site_name} />
                        <Field label="Onset Date" value={ae.ae_start_date?.split('T')[0]} />
                        <Field label="Grade"><AEGradeBadge grade={ae.severity_grade} /></Field>
                        <Field label="Status" value={ae.status} />
                        <Field label="Treatment Related" value={ae.treatment_related ? '✓ Yes' : 'No'} />
                        <Field label="Results in Death" value={ae.results_in_death ? '✓ YES' : 'No'} />
                        <Field label="Life Threatening" value={ae.life_threatening ? '✓ YES' : 'No'} />
                        <Field label="Hospitalization" value={ae.requires_hospitalization ? '✓ YES' : 'No'} />
                    </div>
                </div>

                {/* SAE card if escalated */}
                {isSAE && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <AlertCircle size={16} color="#DC2626" />
                            <strong style={{ color: '#DC2626', fontSize: '0.875rem' }}>Serious Adverse Event</strong>
                        </div>
                        <div style={fieldGrid}>
                            <Field label="SAE Report #" value={ae.sae_report_number} />
                            <Field label="SAE Status"><SeverityBadge level={ae.sae_status ?? ''} /></Field>
                            <Field label="Deadline" value={ae.report_deadline_date?.split('T')[0]} />
                            <Field label="Submitted" value={ae.report_submitted_date?.split('T')[0] ?? 'Not yet'} />
                        </div>
                    </div>
                )}

                {/* Editable fields (Safety Monitor can update causality + outcome) */}
                <div style={sectionStyle}>
                    <h4 style={sectionHeader}>Update Causality & Outcome</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label className="form-label">Causality</label>
                            <select className="form-select" value={causality} onChange={e => setCausality(e.target.value)}>
                                {CAUSALITY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Outcome</label>
                            <select className="form-select" value={outcome} onChange={e => setOutcome(e.target.value)}>
                                {OUTCOME_OPTIONS.map(o => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Reason for Change <span style={{ color: '#DC2626' }}>*</span></label>
                            <textarea className="ack-textarea" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for audit" />
                        </div>
                        <div>
                            <label className="form-label">Confirm Password (21 CFR § 11) <span style={{ color: '#DC2626' }}>*</span></label>
                            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                        </div>
                        {saveMsg && <p style={{ color: saveMsg.includes('✓') ? '#10B981' : '#DC2626', fontSize: '0.8rem' }}>{saveMsg}</p>}
                        <button className="btn-primary" style={{ alignSelf: 'flex-start' }}
                            disabled={updateMut.isPending || !reason || !password}
                            onClick={() => updateMut.mutate()}>
                            {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Related alerts timeline */}
                {ae.relatedAlerts && ae.relatedAlerts.length > 0 && (
                    <div style={sectionStyle}>
                        <h4 style={sectionHeader}>Related Safety Alerts</h4>
                        {/* Because of the && check above, TS now guarantees relatedAlerts is an array here */}
                        {ae.relatedAlerts.map((a) => (
                            <div key={a.alert_id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                                <SeverityBadge level={a.alert_severity} />
                                <span style={{ fontSize: '0.8rem', color: 'var(--gray-700)', flex: 1 }}>{a.alert_message?.slice(0, 80)}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{a.created_at?.split('T')[0]}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const panelStyle: React.CSSProperties = {
    position: 'fixed', top: 0, right: 0, width: 480, height: '100vh',
    background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
    zIndex: 1000, display: 'flex', flexDirection: 'column',
    borderLeft: '1px solid var(--gray-200)',
};
const sectionStyle: React.CSSProperties = { background: 'var(--gray-50)', borderRadius: 8, padding: '1rem' };
const sectionHeader: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };

const Field: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p style={{ margin: '0 0 2px', fontSize: '0.7rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        {children ?? <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--gray-800)', fontWeight: 500 }}>{value ?? '—'}</p>}
    </div>
);

export const AdverseEvents: React.FC = () => {
    const [selectedAeId, setSelectedAeId] = useState<number | null>(null);
    const [trialId, setTrialId] = useState('');
    const [siteId, setSiteId] = useState('');
    const [gradeMin, setGradeMin] = useState<number>(1);
    const [gradeMax, setGradeMax] = useState<number>(5);
    const [causality, setCausality] = useState('');
    const [saeOnly, setSaeOnly] = useState(false);
    const [treatmentOnly, setTreatmentOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);

    const { data: trials } = useQuery({ queryKey: ['safety-trials'], queryFn: () => safetyManagerAPI.getTrials()});
    const { data: sites } = useQuery({ queryKey: ['safety-sites'], queryFn: () => safetyManagerAPI.getSites() });

    const { data: aes = [], isLoading } = useQuery({
        queryKey: ['ae-list', trialId, siteId, gradeMin, gradeMax, causality, saeOnly, treatmentOnly, dateFrom, dateTo, page],
        queryFn: () => safetyManagerAPI.getAes({
            params: {
                trial_id: trialId || undefined, site_id: siteId || undefined,
                severity_min: gradeMin > 1 ? gradeMin : undefined,
                severity_max: gradeMax < 5 ? gradeMax : undefined,
                causality: causality || undefined,
                sae_only: saeOnly || undefined, treatment_related: treatmentOnly || undefined,
                date_from: dateFrom || undefined, date_to: dateTo || undefined, page, limit: 50
            }
        }).then(r => r.data),
    });

    const handleExport = () => {
        const csv = ['AE ID,Patient,Site,AE Term,Onset,Grade,Causality,SAE,Treatment Related,Status',
            ...aes.map((a: any) =>
                `${a.ae_id},${a.trial_patient_id},${a.site_name},"${a.ae_term}",${a.ae_start_date?.split('T')[0]},${a.severity_grade},${a.causality_relationship ?? ''},${a.sae_report_number ? 'Yes' : 'No'},${a.treatment_related ? 'Yes' : 'No'},${a.status}`
            )].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ae_registry.csv'; a.click();
    };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Adverse Events Registry</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>All AEs across all trials · Click row for detail</p>
                </div>
                <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={15} /> Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label className="form-label">Trial</label>
                        <select className="form-select" value={trialId} onChange={e => setTrialId(e.target.value)}>
                            <option value="">All Trials</option>
                            {(trials ?? []).map((t: any) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Causality</label>
                        <select className="form-select" value={causality} onChange={e => setCausality(e.target.value)}>
                            <option value="">Any</option>
                            {CAUSALITY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Grade ≥</label>
                        <select className="form-select" value={gradeMin} onChange={e => setGradeMin(parseInt(e.target.value))}>
                            {[1, 2, 3, 4, 5].map(g => <option key={g} value={g}>Grade {g}+</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">From</label>
                        <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">To</label>
                        <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={saeOnly} onChange={e => setSaeOnly(e.target.checked)} /> SAE Only
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={treatmentOnly} onChange={e => setTreatmentOnly(e.target.checked)} /> Treatment-Related Only
                        </label>
                    </div>
                </div>
            </div>

            {/* Table + side panel */}
            <div style={{ display: 'flex', gap: 24 }}>
                <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
                    {isLoading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading adverse events…</div>
                    ) : aes.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>No adverse events found.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="sm-table">
                                <thead>
                                    <tr>
                                        <th>AE ID</th><th>Patient</th><th>Site</th><th>AE Term</th>
                                        <th>Onset</th><th>Grade</th><th>Causality</th><th>SAE</th>
                                        <th>Tx Related</th><th>Status</th><th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aes.map((ae: any) => (
                                        <tr key={ae.ae_id}
                                            onClick={() => setSelectedAeId(ae.ae_id)}
                                            style={{ cursor: 'pointer', background: selectedAeId === ae.ae_id ? 'var(--color-primary-light)' : undefined }}>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>#{ae.ae_id}</td>
                                            <td style={{ fontWeight: 600 }}>{ae.trial_patient_id}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{ae.site_name}</td>
                                            <td style={{ fontWeight: 600 }}>{ae.ae_term}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{ae.ae_start_date?.split('T')[0]}</td>
                                            <td><AEGradeBadge grade={ae.severity_grade} /></td>
                                            <td style={{ fontSize: '0.78rem' }}>{ae.causality_relationship ?? '—'}</td>
                                            <td>{ae.sae_report_number ? <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.75rem' }}>SAE</span> : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                                            <td style={{ textAlign: 'center' }}>{ae.treatment_related ? '✓' : '—'}</td>
                                            <td><span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{ae.status ?? 'Active'}</span></td>
                                            <td><ChevronRight size={14} color="var(--gray-400)" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--gray-500)', fontSize: '0.875rem' }}>Page {page}</span>
                        <button className="btn-secondary" disabled={aes.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                </div>
            </div>

            {/* Slide-in detail panel */}
            {selectedAeId && (
                <>
                    <div onClick={() => setSelectedAeId(null)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 999 }} />
                    <AEDetailPanel aeId={selectedAeId} onClose={() => setSelectedAeId(null)} />
                </>
            )}
        </div>
    );
};

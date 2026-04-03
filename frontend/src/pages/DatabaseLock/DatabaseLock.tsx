import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, CheckCircle, XCircle, Copy, AlertTriangle, X, Info } from 'lucide-react';
import '../Dashboard.css';
import { dataManagerAPI } from '../../services/api';

//page for datamanager
export interface TrialData {
    trial_id: number;
    trial_title: string;
}

export interface ReadinessData { 
    trial_id: number; 
    trial_title: string; 
    open_queries: number | string; 
    unsigned_forms: number | string; 
    missing_data_pct: number | string; 
    undocumented_deviations: number | string; 
    critical_alerts: number | string; 
    open_saes: number | string; 
    has_active_lock: boolean; 
}

export interface LockRow { 
    lock_id: number; 
    trial_title: string; 
    trial_id: number; 
    lock_type: string; 
    lock_date: string; 
    locked_by_username: string; 
    snapshot_hash: string; 
    unlock_date: string | null; 
}


//Lock type badge 
const lockColors: Record<string, { bg: string; color: string }> = {
    Interim:  { bg: '#DBEAFE', color: '#1D4ED8' },
    Final:    { bg: '#EDE9FE', color: '#5B21B6' },
    Database: { bg: '#FEE2E2', color: '#DC2626' },
    Partial:  { bg: '#FEF3C7', color: '#92400E' },
};
const LockBadge = ({ type }: { type: string }) => {
    const { bg, color } = lockColors[type] ?? { bg: '#F3F4F6', color: '#374151' };
    return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{type}</span>;
};

// ── Readiness check row ────────────────────────────────────────────────────────
const CheckRow: React.FC<{ label: string; pass: boolean; value: string | number; note?: string }> = ({ label, pass, value, note }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {pass ? <CheckCircle size={18} color="#16A34A" /> : <XCircle size={18} color="#DC2626" />}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937' }}>{label}</span>
            {note && <span style={{ fontSize: 11, color: '#9CA3AF' }}>({note})</span>}
        </div>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: pass ? '#16A34A' : '#DC2626' }}>{value}</span>
    </div>
);

// ── 21 CFR E-Signature section (inline, not modal) ────────────────────────────
const LOCK_DESCRIPTIONS: Record<string, string> = {
    Interim:  'Locks data for interim analysis. The trial continues and new data can still be entered.',
    Final:    'Permanent lock after trial completion. Requires ALL readiness checks to pass.',
    Database: 'Full database freeze. All data entry is blocked for this trial.',
    Partial:  'Locks a specific patient population. Define the scope below.',
};

export const DatabaseLock: React.FC = () => {
    const qc = useQueryClient();
    const [trialId, setTrialId] = useState('');
    const [lockType, setLockType]         = useState('Interim');
    const [lockScope, setLockScope]       = useState('');
    const [reason, setReason]             = useState('');
    const [certLock, setCertLock]         = useState<any>(null);
    const [msg, setMsg]                   = useState('');
    const [copiedHash, setCopiedHash]     = useState<number | null>(null);

    const { data: trials = [] } = useQuery<TrialData[]>({ 
        queryKey: ['dm-trials'], 
        queryFn: () => dataManagerAPI.getTrials() 
    });
    
    const { data: readiness, isLoading: rLoading } = useQuery<ReadinessData>({
        queryKey: ['lock-readiness', trialId],
        queryFn: () => dataManagerAPI.getLockReadiness(trialId),
        enabled: !!trialId,
    });
    
    const { data: locks = [], isLoading: lLoading } = useQuery<LockRow[]>({
        queryKey: ['locks'],
        queryFn: () => dataManagerAPI.getLocks(),
    });

    const rd = readiness;
    const queriesPass  = rd ? Number(rd.open_queries) === 0 : false;
    const unsignedPass = rd ? Number(rd.unsigned_forms) === 0 : false;
    const missingPass  = rd ? Number(rd.missing_data_pct) < 2 : false;
    const devPass      = rd ? Number(rd.undocumented_deviations) === 0 : false;
    const alertsPass   = rd ? Number(rd.critical_alerts) === 0 : false;
    const saesPass     = rd ? Number(rd.open_saes) === 0 : false;
    const allPass      = queriesPass && unsignedPass && missingPass && devPass && alertsPass && saesPass;
    
    const isFinalLock  = lockType === 'Final';
    const canSubmit    = reason.length >= 50 && (lockType !== 'Partial' || lockScope.trim()) && (!isFinalLock || allPass);

    const lockMut = useMutation({
        mutationFn: () => dataManagerAPI.initiateLock({ 
            trial_id: parseInt(trialId), 
            lock_type: lockType, 
            lock_scope: lockScope, 
            reason 
        }),
        onSuccess: (res) => { 
            setCertLock(res.lock); 
            setMsg(''); 
            qc.invalidateQueries({ queryKey: ['locks'] }); 
            qc.invalidateQueries({ queryKey: ['lock-readiness', trialId] }); 
        },
        onError: (e: any) => setMsg(e.response?.data?.error ?? e.message),
    });

    const copyHash = (hash: string, lockId: number) => {
        navigator.clipboard.writeText(hash);
        setCopiedHash(lockId);
        setTimeout(() => setCopiedHash(null), 2000);
    };

    // Active lock banner check
    const activeLockForTrial = locks.find(l => l.trial_id === parseInt(trialId) && !l.unlock_date);

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Database Lock</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>Initiate and manage database locks for trial data integrity</p>
                </div>
                <div style={{ minWidth: 240 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Trial</label>
                    <select className="form-select" value={trialId} onChange={e => { setTrialId(e.target.value); setCertLock(null); setMsg(''); }}>
                        <option value="">Select trial…</option>
                        {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                    </select>
                </div>
            </div>

            {/* Active lock trigger banner */}
            {activeLockForTrial && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <Lock size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#DC2626', fontSize: '0.9rem' }}>🔒 {activeLockForTrial.lock_type} Lock is Active for this Trial</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9A3412' }}>
                            Database trigger <code style={{ background: '#FEE2E2', padding: '1px 6px', borderRadius: 4 }}>trg_enforce_data_lock_ecrf</code> is now blocking all eCRF edits.
                            Trigger <code style={{ background: '#FEE2E2', padding: '1px 6px', borderRadius: 4 }}>trg_enforce_data_lock_labs</code> is blocking all lab result edits.
                        </p>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Lock Readiness Checklist */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><CheckCircle size={16} /> Lock Readiness</h3>
                        {rd && <span style={{ background: allPass ? '#D1FAE5' : '#FEE2E2', color: allPass ? '#065F46' : '#DC2626', padding: '3px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>{allPass ? '✓ READY TO LOCK' : '⚠ ISSUES FOUND'}</span>}
                    </div>
                    <div style={{ padding: '0.5rem 1.5rem 1rem' }}>
                        {!trialId ? (
                            <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>Select a trial to check readiness</p>
                        ) : rLoading ? (
                            <div style={{ padding: '1rem 0' }}>{[...Array(6)].map((_, i) => <div key={i} style={{ height: 14, background: '#F3F4F6', borderRadius: 4, marginBottom: 12, width: '80%' }} />)}</div>
                        ) : rd ? (
                            <>
                                <CheckRow label="Open Queries" pass={queriesPass} value={Number(rd.open_queries)} note="must be 0 for Final lock" />
                                <CheckRow label="Unsigned Forms" pass={unsignedPass} value={Number(rd.unsigned_forms)} note="must be 0" />
                                <CheckRow label="Missing Data" pass={missingPass} value={`${Number(rd.missing_data_pct).toFixed(1)}%`} note="target < 2%" />
                                <CheckRow label="Undocumented Deviations" pass={devPass} value={Number(rd.undocumented_deviations)} />
                                <CheckRow label="Critical/Severe Safety Alerts" pass={alertsPass} value={Number(rd.critical_alerts)} />
                                <CheckRow label="Open SAEs" pass={saesPass} value={Number(rd.open_saes)} />
                            </>
                        ) : null}
                    </div>
                </div>

                {/* Initiate Lock Form */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Lock size={16} /> Initiate Lock</h3>
                    </div>
                    <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Lock type selector */}
                        <div>
                            <label className="form-label">Lock Type <span style={{ color: '#DC2626' }}>*</span></label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                {(['Interim','Final','Database','Partial'] as const).map(lt => (
                                    <label key={lt} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${lockType === lt ? '#3B82F6' : '#E5E7EB'}`, background: lockType === lt ? '#EFF6FF' : 'white' }}>
                                        <input type="radio" name="lockType" value={lt} checked={lockType === lt} onChange={() => setLockType(lt)} style={{ marginTop: 2 }} />
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8rem' }}>{lt}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>{LOCK_DESCRIPTIONS[lt]}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Partial scope */}
                        {lockType === 'Partial' && (
                            <div>
                                <label className="form-label">Lock Scope <span style={{ color: '#DC2626' }}>*</span></label>
                                <textarea className="form-input" rows={2} value={lockScope} onChange={e => setLockScope(e.target.value)} placeholder="e.g. Patients enrolled before 2025-01-01 at Site A" style={{ resize: 'vertical' }} />
                            </div>
                        )}

                        {/* Final lock warning */}
                        {isFinalLock && (
                            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '0.75rem', display: 'flex', gap: 8 }}>
                                <AlertTriangle size={16} color="#F97316" style={{ flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9A3412', lineHeight: 1.4 }}>Final lock <strong>cannot be undone without Admin approval</strong>. All readiness checks must pass before this button is enabled.</p>
                            </div>
                        )}

                        {/* Reason (21 CFR) */}
                        <div>
                            <label className="form-label">Reason <span style={{ color: '#DC2626' }}>*</span> <span style={{ fontSize: 11, color: '#9CA3AF' }}>({50 - reason.length > 0 ? `min ${50 - reason.length} more chars` : '✓'})</span></label>
                            <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide detailed justification for this lock (min 50 characters)" style={{ resize: 'vertical' }} />
                        </div>

                        {msg && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem' }}>{msg}</div>}

                        <button className="btn-primary" disabled={!trialId || !canSubmit || lockMut.isPending || !!activeLockForTrial}
                            onClick={() => lockMut.mutate()}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <Lock size={14} /> {lockMut.isPending ? 'Initiating Lock…' : `Initiate ${lockType} Lock`}
                        </button>
                        {activeLockForTrial && <p style={{ fontSize: 11, color: '#DC2626', margin: 0 }}>A lock is already active for this trial.</p>}
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>Calls stored procedure: sp_lock_database</p>
                    </div>
                </div>
            </div>

            {/* Lock Certificate */}
            {certLock && (
                <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid #16A34A' }}>
                    <div className="card-header" style={{ background: '#D1FAE5' }}>
                        <h3 className="card-title" style={{ color: '#065F46' }}>🔒 Data Lock Certificate</h3>
                        <span style={{ fontSize: 11, color: '#059669' }}>Generated by sp_lock_database</span>
                    </div>
                    <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        {[['Lock ID', `#${certLock.lock_id}`], ['Trial', certLock.trial_title], ['Lock Type', certLock.lock_type], ['Locked By', certLock.locked_by_username], ['Timestamp', new Date(certLock.lock_date).toLocaleString()]].map(([l, v]) => (
                            <div key={l}><p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{l}</p><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '0.9rem', color: '#1F2937' }}>{v}</p></div>
                        ))}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Snapshot Hash</p>
                            <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151', wordBreak: 'break-all' }}>{certLock.snapshot_hash}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Locks Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Active & Historical Locks</h3>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Unlock action requires System Admin — view only for Data Manager</span>
                </div>
                {lLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading locks…</div>
                ) : locks.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                        <Info size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                        <p style={{ margin: 0 }}>No data locks have been initiated yet.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB' }}>
                                    {['Lock ID', 'Trial', 'Type', 'Locked By', 'Locked At', 'Snapshot Hash', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {locks.map((l, i) => (
                                    <tr key={l.lock_id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>#{l.lock_id}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.trial_title}</td>
                                        <td style={{ padding: '10px 12px' }}><LockBadge type={l.lock_type} /></td>
                                        <td style={{ padding: '10px 12px', color: '#374151' }}>{l.locked_by_username}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(l.lock_date).toLocaleString()}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <code style={{ fontSize: 11, color: '#6B7280' }}>{l.snapshot_hash?.slice(0, 16)}…</code>
                                                <button title="Copy full hash" onClick={() => copyHash(l.snapshot_hash, l.lock_id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedHash === l.lock_id ? '#16A34A' : '#9CA3AF', padding: 2 }}>
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            {l.unlock_date
                                                ? <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>UNLOCKED</span>
                                                : <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>ACTIVE</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
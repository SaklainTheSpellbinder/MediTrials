import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Lock, Unlock, ShieldCheck, ShieldAlert } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';
import { adminAPI } from '../../services/api';

// --- Type Interfaces ---
interface DataLock {
    lock_id: number;
    trial_title: string;
    lock_type: string;
    locked_by: string | null;
    lock_date: string;
    unlock_date: string | null;
    snapshot_hash: string;
}

interface VerifyResult {
    matches?: boolean;
    error?: boolean;
}
// ------------------------

const LOCK_TYPES = ['Interim', 'Final', 'Database', 'Partial'];

export const LockManagement: React.FC = () => {
    const qc = useQueryClient();
    
    // UI State
    const [lockModal, setLockModal] = useState(false);
    const [lockForm, setLockForm] = useState({ trial_id: '', lock_type: 'Interim' });
    const [unlockModal, setUnlockModal] = useState<DataLock | null>(null);
    const [unlockReason, setUnlockReason] = useState('');
    const [verifyResult, setVerifyResult] = useState<Record<number, VerifyResult>>({});
    const [lockErr, setLockErr] = useState('');

    // Data Fetching
    const { data: locks = [], isLoading } = useQuery<DataLock[]>({ 
        queryKey: ['admin', 'locks'], 
        queryFn: () => adminAPI.getLocks() 
    });
    
    const { data: trials = [] } = useQuery({ 
        queryKey: ['admin', 'trials'], 
        queryFn: () => adminAPI.getTrials() 
    });

    // Mutations
    const lockMut = useMutation({
        mutationFn: () => adminAPI.createLock({ 
            trial_id: parseInt(lockForm.trial_id), 
            lock_type: lockForm.lock_type 
        }),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['admin', 'locks'] }); 
            setLockModal(false); 
            setLockErr(''); 
        },
        onError: (e: any) => setLockErr(e.response?.data?.error ?? e.message),
    });

    const unlockMut = useMutation({
        mutationFn: () => adminAPI.unlockTrial(unlockModal!.lock_id, unlockReason),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['admin', 'locks'] }); 
            setUnlockModal(null); 
            setUnlockReason(''); 
        },
    });

    // Actions
    const verify = async (lockId: number) => {
        try { 
            const data = await adminAPI.verifyLock(lockId); 
            setVerifyResult(v => ({ ...v, [lockId]: data })); 
        } catch { 
            setVerifyResult(v => ({ ...v, [lockId]: { error: true } })); 
        }
    };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">Lock Management</h1>
                <button onClick={() => setLockModal(true)} className="btn-primary">
                    <Plus size={14} /> Lock Trial
                </button>
            </div>

            {/* Lock Modal */}
            {lockModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 360 }}>
                        <h3 style={{ marginBottom: 12 }}>Lock Trial Database</h3>
                        {lockErr && <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{lockErr}</div>}
                        
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 }}>Trial</label>
                        <select value={lockForm.trial_id} onChange={e => setLockForm(f => ({ ...f, trial_id: e.target.value }))} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 13, marginBottom: 10 }}>
                            <option value="">Select trial…</option>
                            {trials.map((t: any) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                        
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 }}>Lock Type</label>
                        <select value={lockForm.lock_type} onChange={e => setLockForm(f => ({ ...f, lock_type: e.target.value }))} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 13, marginBottom: 14 }}>
                            {LOCK_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => lockMut.mutate()} disabled={!lockForm.trial_id || lockMut.isPending} className="btn-primary" style={{ background: '#DC2626' }}>
                                <Lock size={12} /> Confirm Lock
                            </button>
                            <button onClick={() => { setLockModal(false); setLockErr(''); }} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Modal */}
            {unlockModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 400 }}>
                        <h3 style={{ marginBottom: 8 }}>Unlock — {unlockModal.trial_title}</h3>
                        <p style={{ fontSize: 12, color: '#D97706', marginBottom: 10 }}>⚠️ Reason required (21 CFR Part 11).</p>
                        <textarea 
                            value={unlockReason} 
                            onChange={e => setUnlockReason(e.target.value)} 
                            rows={3} 
                            placeholder="Unlock reason…"
                            style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 12, resize: 'none' }} 
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => unlockMut.mutate()} disabled={!unlockReason || unlockMut.isPending} className="btn-primary">
                                <Unlock size={12} /> Unlock
                            </button>
                            <button onClick={() => setUnlockModal(null)} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Locks Table */}
            <div className="card">
                {isLoading ? <div className="sm-empty">Loading locks…</div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Lock ID', 'Trial', 'Type', 'Locked By', 'Locked At', 'Status', 'Hash', 'Actions'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {locks.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>No locks found</td></tr>
                                    : locks.map((l) => (
                                        <React.Fragment key={l.lock_id}>
                                            <tr>
                                                <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11 }}>#{l.lock_id}</td>
                                                <td style={{ padding: '9px 10px', fontWeight: 600 }}>{l.trial_title}</td>
                                                <td style={{ padding: '9px 10px' }}><span className="admin-badge admin-badge-purple">{l.lock_type}</span></td>
                                                <td style={{ padding: '9px 10px', color: '#6B7280' }}>{l.locked_by}</td>
                                                <td style={{ padding: '9px 10px', fontSize: 12, color: '#6B7280' }}>{new Date(l.lock_date).toLocaleString()}</td>
                                                <td style={{ padding: '9px 10px' }}>
                                                    {l.unlock_date == null ? <span className="admin-badge admin-badge-red">Active</span> : <span className="admin-badge admin-badge-gray">Unlocked</span>}
                                                </td>
                                                <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF' }}>
                                                    {l.snapshot_hash?.substring(0, 16)}…
                                                </td>
                                                <td style={{ padding: '9px 10px' }}>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={() => verify(l.lock_id)} className="admin-act-btn" style={{ fontSize: 11 }}>
                                                            <ShieldCheck size={11} /> Verify
                                                        </button>
                                                        {l.unlock_date == null && (
                                                            <button onClick={() => setUnlockModal(l)} className="admin-act-btn" style={{ fontSize: 11, color: '#D97706' }}>
                                                                <Unlock size={11} /> Unlock
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {verifyResult[l.lock_id] && (
                                                <tr><td colSpan={8} style={{ background: verifyResult[l.lock_id].matches ? '#D1FAE5' : '#FEE2E2', padding: '8px 12px', fontSize: 12 }}>
                                                    {verifyResult[l.lock_id].matches
                                                        ? <><ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', color: '#065F46' }} /> <span style={{ color: '#065F46' }}>Hash matches — integrity confirmed.</span></>
                                                        : <><ShieldAlert size={13} style={{ display: 'inline', verticalAlign: 'middle', color: '#991B1B' }} /> <span style={{ color: '#991B1B' }}>Hash MISMATCH — data may have changed!</span></>
                                                    }
                                                </td></tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
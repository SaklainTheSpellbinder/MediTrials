import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FileText, Upload, GitCompare, AlertTriangle, CheckCircle, Clock, ChevronRight, X } from 'lucide-react';
import '../Dashboard.css';

const api = axios.create({ baseURL: 'http://localhost:5000' });
api.interceptors.request.use(cfg => { const raw = localStorage.getItem('user'); if (raw) cfg.headers['X-User-Data'] = btoa(raw); return cfg; });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Protocol { protocol_id: number; version_number: string; amendment_number: number; approval_date: string | null; valid_from: string | null; valid_to: string | null; protocol_document: any; electronic_signature: string; approved_by_username: string | null; }

// ── Section badge (valid_to=null → active) ────────────────────────────────────
const VersionBadge = ({ p }: { p: Protocol }) => {
    const isActive = !p.valid_to;
    return (
        <span style={{ background: isActive ? '#D1FAE5' : '#F3F4F6', color: isActive ? '#065F46' : '#6B7280', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
            {isActive ? 'CURRENT' : 'SUPERSEDED'}
        </span>
    );
};

// ── JSON Diff for protocol comparison ─────────────────────────────────────────
const ProtocolCompare: React.FC<{ v1: Protocol; v2: Protocol; onClose: () => void }> = ({ v1, v2, onClose }) => {
    const doc1 = v1.protocol_document ?? {};
    const doc2 = v2.protocol_document ?? {};
    const allKeys = [...new Set([...Object.keys(doc1), ...Object.keys(doc2)])];
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 740, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Protocol Version Comparison</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[v1, v2].map((v, i) => (
                        <div key={i} style={{ background: i === 0 ? '#FFF1F2' : '#F0FFF4', border: `1px solid ${i === 0 ? '#FECDD3' : '#BBF7D0'}`, borderRadius: 8, padding: '0.875rem' }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>v{v.version_number} {v.amendment_number ? `(Amend. ${v.amendment_number})` : ''}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7280' }}>Approved: {v.approval_date?.split('T')[0] ?? '—'}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>Valid from: {v.valid_from?.split('T')[0] ?? '—'}</p>
                        </div>
                    ))}
                </div>
                {allKeys.length === 0 ? (
                    <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem' }}>No protocol document content available for comparison.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ background: '#F9FAFB' }}>
                                {['Field', `v${v1.version_number}`, `v${v2.version_number}`].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allKeys.map(key => {
                                const val1 = JSON.stringify(doc1[key] ?? null);
                                const val2 = JSON.stringify(doc2[key] ?? null);
                                const changed = val1 !== val2;
                                return (
                                    <tr key={key} style={{ background: changed ? '#FFFBEB' : 'white', borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{key}</td>
                                        <td style={{ padding: '8px 12px', color: changed ? '#DC2626' : '#374151', fontFamily: 'monospace', fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val1}>{val1}</td>
                                        <td style={{ padding: '8px 12px', color: changed ? '#16A34A' : '#374151', fontFamily: 'monospace', fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val2}>
                                            {val2}
                                            {changed && <span style={{ marginLeft: 6, background: '#FEF3C7', color: '#92400E', padding: '0 4px', borderRadius: 3, fontSize: 10, fontFamily: 'sans-serif' }}>changed</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// ── Upload New Protocol Modal ─────────────────────────────────────────────────
const UploadProtocolModal: React.FC<{ trialId: string; onClose: () => void; onSuccess: () => void }> = ({ trialId, onClose, onSuccess }) => {
    const { data: users = [] } = useQuery({ queryKey: ['dm-all-users'], queryFn: () => api.get('/api/data-management/audit/users').then(r => r.data) });
    const [form, setForm] = useState({ version_number: '', amendment_number: '0', approval_date: '', approved_by_user_id: '', reason: '' });
    const [docFields, setDocFields] = useState<{ key: string; value: string }[]>([{ key: 'title', value: '' }, { key: 'phase', value: '' }, { key: 'indication', value: '' }]);
    const [msg, setMsg] = useState('');

    const setFld = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
    const updateDocField = (i: number, k: 'key' | 'value', v: string) => setDocFields(s => s.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
    const addDocField = () => setDocFields(s => [...s, { key: '', value: '' }]);

    const submit = async () => {
        if (!form.version_number || !form.approved_by_user_id || !form.reason) { setMsg('Version, approver, and reason are required'); return; }
        const protocol_document = Object.fromEntries(docFields.filter(f => f.key).map(f => [f.key, f.value]));
        try {
            await api.post('/api/data-management/protocols', {
                trial_id: parseInt(trialId), version_number: form.version_number,
                amendment_number: parseInt(form.amendment_number) || 0,
                approval_date: form.approval_date || null, approved_by_user_id: parseInt(form.approved_by_user_id),
                protocol_document, reason: form.reason,
            });
            onSuccess();
            onClose();
        } catch (e: any) { setMsg(e.response?.data?.error ?? e.message); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontWeight: 700 }}>Upload New Protocol Version</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label className="form-label">Version Number <span style={{ color: '#DC2626' }}>*</span></label>
                            <input className="form-input" value={form.version_number} onChange={e => setFld('version_number', e.target.value)} placeholder="e.g. 2.1" />
                        </div>
                        <div>
                            <label className="form-label">Amendment Number</label>
                            <input className="form-input" type="number" value={form.amendment_number} onChange={e => setFld('amendment_number', e.target.value)} placeholder="0" min="0" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label className="form-label">Approval Date</label>
                            <input className="form-input" type="date" value={form.approval_date} onChange={e => setFld('approval_date', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label">Approved By <span style={{ color: '#DC2626' }}>*</span></label>
                            <select className="form-select" value={form.approved_by_user_id} onChange={e => setFld('approved_by_user_id', e.target.value)}>
                                <option value="">Select user…</option>
                                {(users as any[]).map((u: any) => <option key={u.user_id} value={u.user_id}>{u.username} ({u.role?.replace(/_/g,' ')})</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Protocol document JSONB fields */}
                    <div>
                        <label className="form-label">Protocol Document Fields <span style={{ fontSize: 11, color: '#9CA3AF' }}>(stored as JSONB)</span></label>
                        {docFields.map((f, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                <input className="form-input" style={{ flex: 1, fontSize: 12 }} value={f.key} onChange={e => updateDocField(i, 'key', e.target.value)} placeholder="Field key…" />
                                <input className="form-input" style={{ flex: 2, fontSize: 12 }} value={f.value} onChange={e => updateDocField(i, 'value', e.target.value)} placeholder="Value…" />
                                <button onClick={() => setDocFields(s => s.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={14} /></button>
                            </div>
                        ))}
                        <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={addDocField}>+ Add Field</button>
                    </div>

                    {/* 21 CFR Reason */}
                    <div>
                        <label className="form-label">Reason for Upload <span style={{ color: '#DC2626' }}>*</span></label>
                        <textarea className="form-input" rows={3} value={form.reason} onChange={e => setFld('reason', e.target.value)} placeholder="Required for 21 CFR Part 11 audit trail. Describe the changes in this version…" style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '0.75rem', display: 'flex', gap: 8 }}>
                        <AlertTriangle size={15} color="#F97316" style={{ flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#9A3412' }}>
                            Uploading marks all previous versions as SUPERSEDED. Trigger <code style={{ background: '#FEF3C7', padding: '0 4px', borderRadius: 3 }}>trg_invalidate_protocol</code> fires automatically.
                        </p>
                    </div>
                </div>
                {msg && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 8 }}>{msg}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={submit} disabled={!form.version_number || !form.approved_by_user_id || !form.reason}>
                        <Upload size={13} style={{ marginRight: 4 }} />Upload Protocol
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Protocol Detail Panel (right side) ────────────────────────────────────────
const ProtocolDetail: React.FC<{ protocol: Protocol }> = ({ protocol: p }) => {
    const doc = p.protocol_document ?? {};
    return (
        <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>v{p.version_number}</h3>
                    {p.amendment_number > 0 && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>Amendment {p.amendment_number}</p>}
                </div>
                <VersionBadge p={p} />
            </div>

            {/* Signature / dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                {[
                    ['Approved By', p.approved_by_username ?? '—'],
                    ['Approval Date', p.approval_date?.split('T')[0] ?? '—'],
                    ['Valid From', p.valid_from?.split('T')[0] ?? '—'],
                    ['Valid To', p.valid_to?.split('T')[0] ?? 'Active (current)'],
                ].map(([l, v]) => (
                    <div key={l} style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 10px' }}>
                        <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{l}</p>
                        <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '0.85rem', color: '#1F2937' }}>{v}</p>
                    </div>
                ))}
            </div>

            {/* E-signature */}
            {p.electronic_signature && (
                <div style={{ background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#5B21B6', textTransform: 'uppercase' }}>Electronic Signature</p>
                    <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#6D28D9', wordBreak: 'break-all' }}>{p.electronic_signature}</p>
                </div>
            )}

            {/* Protocol document JSONB content */}
            {Object.keys(doc).length > 0 && (
                <div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protocol Document</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(doc).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', gap: 10, borderBottom: '1px solid #F3F4F6', paddingBottom: 6 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', minWidth: 160, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '0.8rem', color: '#6B7280', flex: 1 }}>{String(v)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Protocols Page ────────────────────────────────────────────────────────
export const Protocols: React.FC = () => {
    const qc = useQueryClient();
    const [trialId, setTrialId]       = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [compareIds, setCompareIds] = useState<[number | null, number | null]>([null, null]);
    const [showCompare, setShowCompare] = useState(false);

    const { data: trials = [] } = useQuery({ queryKey: ['dm-trials'], queryFn: () => api.get('/api/data-management/trials').then(r => r.data) });
    const { data: protocols = [], isLoading } = useQuery({
        queryKey: ['protocols', trialId],
        queryFn: () => api.get(`/api/data-management/protocols/${trialId}`).then(r => r.data),
        enabled: !!trialId,
    });

    const protos = protocols as Protocol[];
    const selectedProto = protos.find(p => p.protocol_id === selectedId);
    const compareV1 = protos.find(p => p.protocol_id === compareIds[0]);
    const compareV2 = protos.find(p => p.protocol_id === compareIds[1]);

    const handleCompare = () => {
        if (protos.length >= 2) {
            setCompareIds([protos[0].protocol_id, protos[1].protocol_id]);
            setShowCompare(true);
        }
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Protocol Library</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>Version management and amendment history for study protocols</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ minWidth: 240 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Trial</label>
                        <select className="form-select" value={trialId} onChange={e => { setTrialId(e.target.value); setSelectedId(null); }}>
                            <option value="">Select trial…</option>
                            {(trials as any[]).map((t: any) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                    </div>
                    {protos.length >= 2 && (
                        <button className="btn-secondary" onClick={handleCompare} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <GitCompare size={14} /> Compare Versions
                        </button>
                    )}
                    {trialId && (
                        <button className="btn-primary" onClick={() => setShowUpload(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Upload size={14} /> Upload New Version
                        </button>
                    )}
                </div>
            </div>

            {!trialId ? (
                <div style={{ padding: '6rem 2rem', textAlign: 'center', color: '#9CA3AF' }}>
                    <FileText size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                    <p style={{ fontWeight: 600, fontSize: '1rem', margin: '0 0 6px', color: '#6B7280' }}>Select a Trial</p>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Choose a trial from the dropdown above to view its protocol history.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    {/* Left: version list */}
                    <div style={{ width: 300, flexShrink: 0 }}>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><FileText size={15} /> Protocol Versions</h3>
                                <span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>{protos.length}</span>
                            </div>
                            {isLoading ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
                            ) : protos.length === 0 ? (
                                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#9CA3AF' }}>
                                    <FileText size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No protocol versions found. Upload the first one.</p>
                                </div>
                            ) : (
                                <div>
                                    {protos.map((p) => {
                                        const isActive = !p.valid_to;
                                        const isSelected = selectedId === p.protocol_id;
                                        return (
                                            <div key={p.protocol_id} onClick={() => setSelectedId(p.protocol_id)}
                                                style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', background: isSelected ? '#EFF6FF' : 'white', borderLeft: isSelected ? '3px solid #3B82F6' : '3px solid transparent', transition: 'all 0.15s' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: isActive ? 700 : 600, fontSize: '0.9rem', color: isSelected ? '#1D4ED8' : '#1F2937' }}>v{p.version_number}</p>
                                                        {p.amendment_number > 0 && <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9CA3AF' }}>Amendment {p.amendment_number}</p>}
                                                    </div>
                                                    <VersionBadge p={p} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                                                    {p.valid_from && <span style={{ fontSize: 10, color: '#9CA3AF' }}><CheckCircle size={10} style={{ marginRight: 2 }} />From: {p.valid_from.split('T')[0]}</span>}
                                                    {p.approval_date && <span style={{ fontSize: 10, color: '#9CA3AF' }}>Approved: {p.approval_date.split('T')[0]}</span>}
                                                </div>
                                                {isSelected && <ChevronRight size={14} color="#3B82F6" style={{ position: 'absolute', right: 12, top: '50%' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Amendment timeline */}
                        {protos.length > 0 && (
                            <div className="card" style={{ marginTop: '1rem' }}>
                                <div className="card-header"><h3 className="card-title" style={{ fontSize: '0.875rem' }}><Clock size={14} /> Amendment Timeline</h3></div>
                                <div style={{ padding: '0.875rem 1rem' }}>
                                    {protos.map((p, i) => (
                                        <div key={p.protocol_id} style={{ display: 'flex', gap: 10, paddingBottom: 12, position: 'relative' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: !p.valid_to ? '#16A34A' : '#D1D5DB', flexShrink: 0, marginTop: 2 }} />
                                                {i < protos.length - 1 && <div style={{ width: 2, flex: 1, background: '#E5E7EB', marginTop: 2 }} />}
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: !p.valid_to ? '#16A34A' : '#374151' }}>v{p.version_number}</p>
                                                <p style={{ margin: '1px 0 0', fontSize: 10, color: '#9CA3AF' }}>{p.valid_from?.split('T')[0] ?? '—'}</p>
                                                {p.amendment_number > 0 && <p style={{ margin: '1px 0 0', fontSize: 10, color: '#F59E0B' }}>Amendment {p.amendment_number}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p style={{ padding: '0 1rem 0.875rem', fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                                    Trigger: trg_invalidate_protocol auto-sets valid_to on supersession
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right: detail view */}
                    <div style={{ flex: 1 }}>
                        {selectedProto ? (
                            <div className="card">
                                <ProtocolDetail protocol={selectedProto} />
                            </div>
                        ) : (
                            <div style={{ padding: '6rem 2rem', textAlign: 'center', color: '#9CA3AF' }}>
                                <FileText size={40} style={{ marginBottom: 12, opacity: 0.2 }} />
                                <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#6B7280' }}>Select a Version</p>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}>Click a protocol version on the left to view its details.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Compare modal */}
            {showCompare && compareV1 && compareV2 && (
                <ProtocolCompare v1={compareV1} v2={compareV2} onClose={() => setShowCompare(false)} />
            )}

            {/* Upload modal */}
            {showUpload && (
                <UploadProtocolModal trialId={trialId} onClose={() => setShowUpload(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['protocols', trialId] })} />
            )}
        </div>
    );
};

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import {
    AlertCircle, Plus, X, ChevronRight, Search, Clock, CheckCircle,
    XCircle, Filter, Download, TrendingUp, Users
} from 'lucide-react';
import '../Dashboard.css';

// ── Axios instance (X-User-Data auth pattern) ─────────────────────────────────
const api = axios.create({ baseURL: 'http://localhost:5000' });
api.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface Query {
    query_id: number;
    field_name: string;
    query_text_short: string;
    query_text_full: string;
    query_status: 'Open' | 'Answered' | 'Resolved' | 'Closed';
    raised_date: string;
    days_open: number;
    response_text: string | null;
    resolved_date: string | null;
    trial_patient_id: string;
    site_name: string;
    site_id: number;
    visit_name: string;
    ecrf_name: string;
    raised_by_username: string;
    resolved_by_username: string | null;
}

// ── Badge helpers ──────────────────────────────────────────────────────────────
const statusColors: Record<string, { bg: string; color: string }> = {
    Open:     { bg: '#DBEAFE', color: '#1D4ED8' },
    Answered: { bg: '#FEF3C7', color: '#92400E' },
    Resolved: { bg: '#D1FAE5', color: '#065F46' },
    Closed:   { bg: '#F3F4F6', color: '#374151' },
};
const StatusBadge = ({ status }: { status: string }) => {
    const { bg, color } = statusColors[status] ?? { bg: '#F3F4F6', color: '#374151' };
    return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{status}</span>;
};

const daysColor = (d: number) => d <= 3 ? '#065F46' : d <= 7 ? '#92400E' : d <= 14 ? '#9A3412' : '#DC2626';
const daysBg   = (d: number) => d <= 3 ? '#D1FAE5' : d <= 7 ? '#FEF3C7' : d <= 14 ? '#FFEDD5' : '#FEE2E2';

// ── 21 CFR Password Re-auth Modal ────────────────────────────────────────────
const ESignModal: React.FC<{
    title: string; onConfirm: (reason: string) => void; onClose: () => void;
    loading?: boolean; children?: React.ReactNode;
}> = ({ title, onConfirm, onClose, loading, children }) => {
    const [reason, setReason] = useState('');
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                {children}
                <div style={{ marginTop: 12 }}>
                    <label className="form-label">Reason <span style={{ color: '#DC2626' }}>*</span></label>
                    <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)}
                        placeholder="Required for 21 CFR Part 11 audit trail" style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" disabled={!reason.trim() || loading}
                        onClick={() => onConfirm(reason)}>
                        {loading ? 'Processing…' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Raise New Query Modal ──────────────────────────────────────────────────────
const RaiseQueryModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
    const [patientId, setPatientId] = useState('');
    const [visitId, setVisitId]     = useState('');
    const [ecrfId, setEcrfId]       = useState('');
    const [fieldName, setFieldName] = useState('');
    const [queryText, setQueryText] = useState('');
    const [msg, setMsg]             = useState('');

    const { data: patients = [] } = useQuery({ queryKey: ['dm-patients'], queryFn: () => api.get('/api/data-management/patients').then(r => r.data) });
    const { data: visits = [] }   = useQuery({ queryKey: ['dm-visits', patientId], queryFn: () => patientId ? api.get(`/api/data-management/patients/${patientId}/visits`).then(r => r.data) : [], enabled: !!patientId });
    const { data: forms = [] }    = useQuery({ queryKey: ['dm-forms', visitId], queryFn: () => visitId ? api.get(`/api/data-management/visits/${visitId}/forms`).then(r => r.data) : [], enabled: !!visitId });

    const selectedForm = forms.find((f: any) => f.ecrf_instance_id === parseInt(ecrfId));
    const schemaKeys   = selectedForm?.ecrf_schema ? Object.keys(selectedForm.ecrf_schema) : [];
    const charLeft     = 500 - queryText.length;

    const submit = async () => {
        if (!ecrfId || !fieldName || queryText.length < 20) { setMsg('Please fill all required fields (query text min 20 chars)'); return; }
        try {
            await api.post('/api/data-management/queries', { ecrf_instance_id: parseInt(ecrfId), field_name: fieldName, query_text: queryText });
            onSuccess();
            onClose();
        } catch (e: any) { setMsg(e.response?.data?.error ?? e.message); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>Raise New Data Query</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label className="form-label">Patient <span style={{ color: '#DC2626' }}>*</span></label>
                        <select className="form-select" value={patientId} onChange={e => { setPatientId(e.target.value); setVisitId(''); setEcrfId(''); }}>
                            <option value="">Select patient…</option>
                            {(patients as any[]).map((p: any) => <option key={p.patient_id} value={p.patient_id}>{p.trial_patient_id} — {p.site_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Visit Instance <span style={{ color: '#DC2626' }}>*</span></label>
                        <select className="form-select" value={visitId} onChange={e => { setVisitId(e.target.value); setEcrfId(''); }} disabled={!patientId}>
                            <option value="">Select visit…</option>
                            {(visits as any[]).map((v: any) => <option key={v.visit_instance_id} value={v.visit_instance_id}>{v.visit_name} — {v.visit_status}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">eCRF Form <span style={{ color: '#DC2626' }}>*</span></label>
                        <select className="form-select" value={ecrfId} onChange={e => setEcrfId(e.target.value)} disabled={!visitId}>
                            <option value="">Select form…</option>
                            {(forms as any[]).map((f: any) => <option key={f.ecrf_instance_id} value={f.ecrf_instance_id}>{f.ecrf_name} [{f.form_status}]</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Field Name <span style={{ color: '#DC2626' }}>*</span></label>
                        {schemaKeys.length > 0
                            ? <select className="form-select" value={fieldName} onChange={e => setFieldName(e.target.value)}>
                                <option value="">Select field…</option>
                                {schemaKeys.map(k => <option key={k}>{k}</option>)}
                              </select>
                            : <input className="form-input" value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="e.g. systolic_bp" />
                        }
                    </div>
                    <div>
                        <label className="form-label">Query Text <span style={{ color: '#DC2626' }}>*</span> <span style={{ color: charLeft < 0 ? '#DC2626' : '#9CA3AF', fontSize: 11 }}>({charLeft} chars left)</span></label>
                        <textarea className="form-input" rows={4} value={queryText} maxLength={500}
                            onChange={e => setQueryText(e.target.value)}
                            placeholder="Minimum 20 characters. Describe the data issue clearly…" style={{ resize: 'vertical' }} />
                    </div>
                </div>
                {msg && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 8 }}>{msg}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={submit} disabled={!ecrfId || !fieldName || queryText.length < 20 || charLeft < 0}>
                        Raise Query
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Query Detail Side Panel ────────────────────────────────────────────────────
const QueryDetailPanel: React.FC<{ queryId: number; onClose: () => void }> = ({ queryId, onClose }) => {
    const qc = useQueryClient();
    const { data: q, isLoading } = useQuery({ queryKey: ['query-detail', queryId], queryFn: () => api.get(`/api/data-management/queries/${queryId}`).then(r => r.data) });
    const [action, setAction]     = useState<string | null>(null);
    const [rejComment, setRejComment] = useState('');
    const [msg, setMsg]           = useState('');

    const updateMut = useMutation({
        mutationFn: ({ act, reason }: { act: string; reason: string }) =>
            api.put(`/api/data-management/queries/${queryId}`, { action: act, rejection_comment: rejComment, reason }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['queries'] }); qc.invalidateQueries({ queryKey: ['query-detail', queryId] }); setAction(null); setMsg(''); },
        onError: (e: any) => setMsg(e.response?.data?.error ?? e.message),
    });

    const panelStyle: React.CSSProperties = {
        position: 'fixed', top: 0, right: 0, width: 500, height: '100vh',
        background: 'white', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
        zIndex: 1100, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #E5E7EB',
    };

    if (isLoading) return (
        <div style={panelStyle}>
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
                {[...Array(6)].map((_, i) => <div key={i} style={{ height: 20, background: '#F3F4F6', borderRadius: 4, marginBottom: 12, width: `${70 + i * 5}%` }} />)}
            </div>
        </div>
    );
    if (!q) return null;

    const isOpen     = q.query_status === 'Open';
    const isAnswered = q.query_status === 'Answered';
    const isResolved = q.query_status === 'Resolved';

    return (
        <div style={panelStyle}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Query #{q.query_id}</h3>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <StatusBadge status={q.query_status} />
                        <span style={{ background: daysBg(q.days_open), color: daysColor(q.days_open), padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{q.days_open}d open</span>
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}><X size={20} /></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Patient & Visit card */}
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '0.875rem', border: '1px solid #E5E7EB' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient & Visit</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[['Patient', q.trial_patient_id], ['Site', q.site_name], ['Visit', q.visit_name], ['Form', q.ecrf_name]].map(([l, v]) => (
                            <div key={l}><p style={{ margin: 0, fontSize: 10, color: '#9CA3AF' }}>{l}</p><p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{v}</p></div>
                        ))}
                    </div>
                </div>

                {/* Original query */}
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '0.875rem', border: '1px solid #BFDBFE' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Query</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Field: {q.field_name}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#1F2937', lineHeight: 1.5 }}>{q.query_text_full}</p>
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6B7280' }}>Raised by {q.raised_by_username} · {new Date(q.raised_date).toLocaleDateString()}</p>
                </div>

                {/* Answered: show response + action buttons */}
                {isAnswered && q.response_text && (
                    <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '0.875rem', border: '1px solid #BBF7D0' }}>
                        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#15803D', textTransform: 'uppercase' }}>Site Response</p>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#1F2937', lineHeight: 1.5 }}>{q.response_text}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setAction('resolve')}>
                                <CheckCircle size={14} /> Accept & Resolve
                            </button>
                            <button className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px', color: '#DC2626', borderColor: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setAction('reject')}>
                                <XCircle size={14} /> Reject & Reopen
                            </button>
                        </div>
                        {action === 'reject' && (
                            <div style={{ marginTop: 10 }}>
                                <textarea className="form-input" rows={2} placeholder="Rejection reason…" value={rejComment} onChange={e => setRejComment(e.target.value)} style={{ fontSize: 13 }} />
                            </div>
                        )}
                    </div>
                )}

                {/* Open: waiting message */}
                {isOpen && (
                    <div style={{ background: '#FFF7ED', borderRadius: 8, padding: '0.875rem', border: '1px solid #FED7AA', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <Clock size={16} color="#F97316" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#9A3412' }}>Awaiting Site Response</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#92400E' }}>Query has been open for {q.days_open} day{q.days_open !== 1 ? 's' : ''}. Site has not yet responded.</p>
                        </div>
                    </div>
                )}

                {/* Resolved: show close option */}
                {isResolved && (
                    <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '0.875rem', border: '1px solid #BBF7D0', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <CheckCircle size={16} color="#16A34A" />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#15803D' }}>Query Resolved</span>
                            {q.resolved_date && <span style={{ fontSize: 11, color: '#6B7280' }}>{new Date(q.resolved_date).toLocaleDateString()}</span>}
                        </div>
                        <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setAction('close')}>Close Query</button>
                    </div>
                )}

                {/* Thread / audit history */}
                {q.thread?.length > 0 && (
                    <div>
                        <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {q.thread.map((t: any, i: number) => (
                                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', marginTop: 6, flexShrink: 0 }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#374151' }}><strong>{t.username ?? 'System'}</strong> — {t.action_type}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>{t.change_reason} · {new Date(t.change_timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {msg && <p style={{ color: '#DC2626', fontSize: '0.8rem' }}>{msg}</p>}
            </div>

            {/* 21 CFR modal for confirm actions */}
            {action && (
                <ESignModal
                    title={action === 'resolve' ? 'Accept & Resolve Query' : action === 'reject' ? 'Reject & Reopen Query' : 'Close Query'}
                    loading={updateMut.isPending}
                    onClose={() => setAction(null)}
                    onConfirm={(reason) => updateMut.mutate({ act: action, reason })}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280' }}>
                        {action === 'resolve' ? 'This will mark the query as Resolved.' : action === 'reject' ? 'This will reopen the query for the site to re-answer.' : 'This will permanently close the query.'}
                    </p>
                </ESignModal>
            )}
        </div>
    );
};

// ── Main DataQueries Page ──────────────────────────────────────────────────────
const TABS = ['All', 'Open', 'Answered', 'Resolved', 'Closed'] as const;

export const DataQueries: React.FC = () => {
    const { user } = useAuth();
    const qc = useQueryClient();

    const [activeTab, setActiveTab]         = useState<string>('All');
    const [siteId, setSiteId]               = useState('');
    const [dateFrom, setDateFrom]           = useState('');
    const [dateTo, setDateTo]               = useState('');
    const [search, setSearch]               = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage]                   = useState(1);
    const [selectedQueryId, setSelectedQueryId] = useState<number | null>(null);
    const [showRaiseModal, setShowRaiseModal]   = useState(false);

    // Debounce search 300ms
    const handleSearchChange = useCallback((val: string) => {
        setSearch(val);
        clearTimeout((handleSearchChange as any)._timer);
        (handleSearchChange as any)._timer = setTimeout(() => setDebouncedSearch(val), 300);
    }, []);

    const params = useMemo(() => ({
        status: activeTab === 'All' ? undefined : activeTab,
        site_id: siteId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: debouncedSearch || undefined,
        page, limit: 50,
    }), [activeTab, siteId, dateFrom, dateTo, debouncedSearch, page]);

    const { data, isLoading } = useQuery({
        queryKey: ['queries', params],
        queryFn: () => api.get('/api/data-management/queries', { params }).then(r => r.data),
    });
    const { data: sites = [] } = useQuery({ queryKey: ['dm-sites'], queryFn: () => api.get('/api/data-management/sites').then(r => r.data) });
    const { data: sitePerf = [] } = useQuery({ queryKey: ['site-performance'], queryFn: () => api.get('/api/data-management/site-performance').then(r => r.data) });

    const queries: Query[] = data?.queries ?? [];
    const statusCounts: Record<string, number> = data?.statusCounts ?? {};
    const totalAll = Object.values(statusCounts).reduce((a: any, b: any) => a + parseInt(b as string), 0);

    const handleExportCsv = () => {
        const csv = ['Query ID,Patient,Site,Visit,Form,Field,Status,Days Open,Raised Date,Raised By',
            ...queries.map((q: Query) =>
                `${q.query_id},${q.trial_patient_id},${q.site_name},${q.visit_name},"${q.ecrf_name}","${q.field_name}",${q.query_status},${q.days_open},${q.raised_date?.split('T')[0]},${q.raised_by_username}`
            )].join('\n');
        const b = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'data_queries.csv'; a.click();
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Data Queries</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>Trial-wide query management — {totalAll} total queries</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn-primary" onClick={() => setShowRaiseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={14} /> Raise New Query
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: '1.25rem' }}>
                {TABS.map(tab => {
                    const count = tab === 'All' ? totalAll : (statusCounts[tab] ?? 0);
                    const active = activeTab === tab;
                    return (
                        <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
                            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: active ? 700 : 500, color: active ? 'var(--color-primary)' : '#6B7280', borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {tab}
                            {count > 0 && <span style={{ background: active ? 'var(--color-primary)' : '#E5E7EB', color: active ? 'white' : '#374151', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Filter bar */}
            <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '0 0 180px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Site</label>
                        <select className="form-select" value={siteId} onChange={e => { setSiteId(e.target.value); setPage(1); }}>
                            <option value="">All Sites</option>
                            {(sites as any[]).map((s: any) => <option key={s.site_id} value={s.site_id}>{s.institution_name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '0 0 140px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>From</label>
                        <input className="form-input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
                    </div>
                    <div style={{ flex: '0 0 140px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>To</label>
                        <input className="form-input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
                    </div>
                    <div style={{ flex: '1 1 220px', position: 'relative' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Search (Patient ID or Query Text)</label>
                        <Search size={14} style={{ position: 'absolute', left: 10, bottom: 10, color: '#9CA3AF' }} />
                        <input className="form-input" style={{ paddingLeft: 30 }} value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Search…" />
                    </div>
                </div>
            </div>

            {/* Main table */}
            <div className="card" style={{ overflow: 'hidden' }}>
                {isLoading ? (
                    <div style={{ padding: '1rem' }}>
                        {[...Array(8)].map((_, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                                {[60, 90, 120, 100, 120, 80, 60, 80].map((w, j) => (
                                    <div key={j} style={{ height: 14, width: w, background: '#F3F4F6', borderRadius: 3, animation: 'pulse 1.5s infinite' }} />
                                ))}
                            </div>
                        ))}
                    </div>
                ) : queries.length === 0 ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#9CA3AF' }}>
                        <AlertCircle size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#6B7280' }}>No queries found</p>
                        <p style={{ fontSize: '0.875rem', margin: 0 }}>{activeTab === 'Open' ? 'All data is clean — no open queries.' : 'No queries match the current filters.'}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB' }}>
                                    {['ID', 'Patient', 'Site', 'Visit', 'Form', 'Field', 'Query', 'Raised', 'Days Open', 'Status', 'By', ''].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {queries.map((q: Query, idx: number) => (
                                    <tr key={q.query_id} onClick={() => setSelectedQueryId(q.query_id)}
                                        style={{ cursor: 'pointer', background: selectedQueryId === q.query_id ? '#EFF6FF' : idx % 2 === 0 ? 'white' : '#FAFAFA', transition: 'background 0.15s' }}
                                        onMouseEnter={e => { if (selectedQueryId !== q.query_id) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                                        onMouseLeave={e => { if (selectedQueryId !== q.query_id) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'white' : '#FAFAFA'; }}>
                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>#{q.query_id}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{q.trial_patient_id}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.site_name}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{q.visit_name}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.ecrf_name}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{q.field_name}</td>
                                        <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6B7280', fontSize: 12 }} title={q.query_text_full}>{q.query_text_short}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{new Date(q.raised_date).toLocaleDateString()}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{ background: daysBg(q.days_open), color: daysColor(q.days_open), padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{q.days_open}d</span>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}><StatusBadge status={q.query_status} /></td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF' }}>{q.raised_by_username}</td>
                                        <td style={{ padding: '10px 12px' }}><ChevronRight size={14} color="#D1D5DB" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Pagination */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 13, color: '#9CA3AF' }}>{queries.length} results on page {page}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                        <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} disabled={queries.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                </div>
            </div>

            {/* Site Performance Panel (Complex Query 2) */}
            {sitePerf.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header">
                        <h3 className="card-title"><TrendingUp size={16} /> Site Query Performance</h3>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Results from Complex Query 2 — RANK() window function</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB' }}>
                                    {['Rank', 'Site', 'Country', 'Total', 'Open', 'Resolved', 'Avg Days', 'Median'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(sitePerf as any[]).map((s: any, i: number) => (
                                    <tr key={s.site_id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: s.resolution_rank <= 3 ? '#16A34A' : '#374151' }}>#{s.resolution_rank}</td>
                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.institution_name}</td>
                                        <td style={{ padding: '8px 12px', color: '#6B7280' }}>{s.country}</td>
                                        <td style={{ padding: '8px 12px' }}>{s.total_queries}</td>
                                        <td style={{ padding: '8px 12px', color: parseInt(s.open_queries) > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>{s.open_queries}</td>
                                        <td style={{ padding: '8px 12px', color: '#16A34A' }}>{s.resolved_queries}</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{ background: daysColor(parseFloat(s.avg_days_to_resolve)) === '#DC2626' ? '#FEE2E2' : '#D1FAE5', color: daysColor(parseFloat(s.avg_days_to_resolve)), padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                                                {s.avg_days_to_resolve ?? '—'}d
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', color: '#6B7280' }}>{s.median_days ?? '—'}d</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Overlays */}
            {selectedQueryId && (
                <>
                    <div onClick={() => setSelectedQueryId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 1099 }} />
                    <QueryDetailPanel queryId={selectedQueryId} onClose={() => setSelectedQueryId(null)} />
                </>
            )}
            {showRaiseModal && <RaiseQueryModal onClose={() => setShowRaiseModal(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['queries'] })} />}
        </div>
    );
};

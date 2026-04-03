import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Download, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Printer, Info } from 'lucide-react';
import '../Dashboard.css';
import { dataManagerAPI } from '../../services/api';

export interface AuditRow { 
    audit_id: number; 
    table_name: string; 
    record_id: number; 
    action_type: string; 
    old_value: any; 
    new_value: any; 
    change_timestamp: string; 
    change_reason: string; 
    ip_address: string | null; 
    data_hash: string; 
    changed_by_username: string | null; 
    changed_by_role: string | null; 
}

export interface SigRow { 
    signature_id: number; 
    document_type: string; 
    document_id: number; 
    signature_hash: string; 
    signing_reason: string; 
    signed_at: string; 
    signatory_username: string | null; 
}

export interface AuditUser {
    user_id: number;
    username: string;
    role: string;
}

//Helpers
const actionColor: Record<string, string> = { INSERT: '#16A34A', UPDATE: '#3B82F6', DELETE: '#DC2626' };
const actionBg:    Record<string, string> = { INSERT: '#D1FAE5', UPDATE: '#DBEAFE', DELETE: '#FEE2E2' };

const TABLES = ['users','clinical_trials','study_sites','data_locks','study_protocols','patients','adverse_events','lab_results','ecrf_data','data_queries','protocol_deviations','electronic_signatures'];
const ACTIONS = ['INSERT','UPDATE','DELETE'];

//JSON Diff Viewer
function diffObjects(old_val: any, new_val: any): { key: string; old: any; new: any; changed: boolean }[] {
    const oldObj  = old_val ? (typeof old_val === 'string' ? JSON.parse(old_val) : old_val) : {};
    const newObj  = new_val ? (typeof new_val === 'string' ? JSON.parse(new_val) : new_val) : {};
    const allKeys = [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];
    return allKeys.map(key => ({
        key,
        old: oldObj[key],
        new: newObj[key],
        changed: JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key]),
    }));
}

const JsonDiff: React.FC<{ old_val: any; new_val: any }> = ({ old_val, new_val }) => {
    if (!old_val && !new_val) return <div style={{ color: '#9CA3AF', fontSize: 11, padding: 8 }}>No value data available.</div>;
    const diffs = diffObjects(old_val, new_val);
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            {old_val && (
                <div>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Old Values</p>
                    <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 6, padding: 8, fontFamily: 'monospace', overflow: 'auto', maxHeight: 160 }}>
                        {diffs.map(d => (
                            <div key={d.key} style={{ padding: '2px 0', color: d.changed ? '#DC2626' : '#6B7280' }}>
                                <span style={{ fontWeight: 700 }}>{d.key}:</span> {d.old !== undefined ? JSON.stringify(d.old) : '—'}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {new_val && (
                <div>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>New Values</p>
                    <div style={{ background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: 8, fontFamily: 'monospace', overflow: 'auto', maxHeight: 160 }}>
                        {diffs.map(d => (
                            <div key={d.key} style={{ padding: '2px 0', color: d.changed ? '#16A34A' : '#6B7280' }}>
                                <span style={{ fontWeight: 700 }}>{d.key}:</span> {d.new !== undefined ? JSON.stringify(d.new) : '—'}
                                {d.changed && <span style={{ marginLeft: 6, background: '#DCFCE7', color: '#15803D', padding: '0 4px', borderRadius: 3 }}>changed</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

//Audit Row (expandable)
const AuditTableRow: React.FC<{ row: AuditRow }> = ({ row }) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <tr onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', background: open ? '#F8FAFF' : 'white' }}
                onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'white'; }}>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(row.change_timestamp).toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{row.table_name}</span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>#{row.record_id}</td>
                <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: actionBg[row.action_type] ?? '#F3F4F6', color: actionColor[row.action_type] ?? '#374151', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{row.action_type}</span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '0.875rem' }}>{row.changed_by_username ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF' }}>{row.changed_by_role?.replace(/_/g,' ')}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.change_reason}>{row.change_reason}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{row.ip_address ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: '#D1D5DB' }}>{row.data_hash?.slice(0, 10)}…</td>
                <td style={{ padding: '10px 12px', color: '#9CA3AF' }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
            </tr>
            {open && (
                <tr style={{ background: '#F8FAFF' }}>
                    <td colSpan={10} style={{ padding: '0 12px 12px' }}>
                        <JsonDiff old_val={row.old_value} new_val={row.new_value} />
                        <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Audit ID:</span>
                                <code style={{ fontSize: 11, color: '#374151' }}>#{row.audit_id}</code>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>SHA-256 Hash:</span>
                                <code style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>{row.data_hash}</code>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

//Main AuditTrail Page
const SUB_TABS = ['Audit Log', 'Electronic Signatures'] as const;

export const AuditTrail: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('Audit Log');
    const [filters, setFilters]     = useState({ table_name: '', user_id: '', action_type: '', date_from: '', date_to: '', record_id: '', page: 1 });
    const setF = (patch: Partial<typeof filters>) => setFilters(f => ({ ...f, ...patch, page: 1 }));

    const params = { 
        ...filters, 
        limit: 50, 
        page: filters.page, 
        user_id: filters.user_id || undefined, 
        table_name: filters.table_name || undefined, 
        action_type: filters.action_type || undefined, 
        date_from: filters.date_from || undefined, 
        date_to: filters.date_to || undefined, 
        record_id: filters.record_id || undefined 
    };

    const { data: auditData, isLoading } = useQuery({
        queryKey: ['dm-audit', params],
        queryFn: () => dataManagerAPI.getAuditLog(params),
    });

    const rows = auditData?.data ?? [];
    const totalCount = auditData?.totalCount ?? 0;

    const { data: auditUsers = [] } = useQuery<AuditUser[]>({ 
        queryKey: ['audit-users'], 
        queryFn: () => dataManagerAPI.getAuditUsers() 
    });
    
    const { data: signatures = [] } = useQuery<SigRow[]>({ 
        queryKey: ['dm-signatures'], 
        queryFn: () => dataManagerAPI.getAuditSignatures(), 
        enabled: activeTab === 'Electronic Signatures' 
    });

    const handlePrint = () => window.print();

    const exportCsv = () => {
        if (!rows.length) return;
        const csv = ['Timestamp,Table,Record,Action,Changed By,Role,Reason,IP,Hash',
            ...rows.map((r: AuditRow) => `"${new Date(r.change_timestamp).toLocaleString()}","${r.table_name}",${r.record_id},"${r.action_type}","${r.changed_by_username ?? ''}","${r.changed_by_role ?? ''}","${(r.change_reason ?? '').replace(/"/g,'""')}","${r.ip_address ?? ''}","${r.data_hash ?? ''}"`)
        ].join('\n');
        const b = new Blob([csv], { type: 'text/csv' }); 
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(b); 
        a.download = 'audit_trail_21cfr.csv'; 
        a.click();
    };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Audit Trail</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>21 CFR Part 11 compliant audit log — immutable, signed records</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Printer size={14} /> Print Report
                    </button>
                </div>
            </div>

            {/* Compliance banner */}
            <div style={{ background: 'linear-gradient(135deg, #1E3A5F, #1D4ED8)', borderRadius: 10, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: 12, alignItems: 'center' }}>
                <Shield size={24} color="white" style={{ flexShrink: 0 }} />
                <div>
                    <p style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>21 CFR Part 11 Compliant Audit Trail</p>
                    <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>All records are cryptographically hashed via <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>audit_table_changes()</code> trigger. Records are immutable. Electronic signatures recorded separately.</p>
                </div>
            </div>

            {/* Sub-tab bar */}
            <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB', marginBottom: '1.25rem' }}>
                {SUB_TABS.map(tab => {
                    const active = activeTab === tab;
                    return (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: active ? 700 : 500, color: active ? 'var(--color-primary)' : '#6B7280', borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2 }}>
                            {tab}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'Audit Log' && (
                <>
                    {/* Filter bar */}
                    <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: '0 0 160px' }}>
                                <label className="form-label" style={{ fontSize: 11 }}>Table</label>
                                <select className="form-select" value={filters.table_name} onChange={e => setF({ table_name: e.target.value })}>
                                    <option value="">All Tables</option>
                                    {TABLES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '0 0 140px' }}>
                                <label className="form-label" style={{ fontSize: 11 }}>Action</label>
                                <select className="form-select" value={filters.action_type} onChange={e => setF({ action_type: e.target.value })}>
                                    <option value="">All Actions</option>
                                    {ACTIONS.map(a => <option key={a}>{a}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '0 0 200px' }}>
                                <label className="form-label" style={{ fontSize: 11 }}>Changed By</label>
                                <select className="form-select" value={filters.user_id} onChange={e => setF({ user_id: e.target.value })}>
                                    <option value="">All Users</option>
                                    {auditUsers.map((u) => <option key={u.user_id} value={u.user_id}>{u.username} ({u.role?.replace(/_/g,' ')})</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '0 0 130px' }}>
                                <label className="form-label" style={{ fontSize: 11 }}>Record ID</label>
                                <input className="form-input" type="number" value={filters.record_id} onChange={e => setF({ record_id: e.target.value })} placeholder="ID…" />
                            </div>
                            <div style={{ flex: '0 0 130px' }}>
                                <label className="form-label" style={{ fontSize: 11 }}>From</label>
                                <input className="form-input" type="date" value={filters.date_from} onChange={e => setF({ date_from: e.target.value })} />
                            </div>
                            <div style={{ flex: '0 0 130px' }}>
                                <label className="form-label" style={{ fontSize: 11 }}>To</label>
                                <input className="form-input" type="date" value={filters.date_to} onChange={e => setF({ date_to: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* Audit table */}
                    <div className="card">
                        {isLoading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading audit entries…</div>
                        ) : rows.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                                <AlertCircle size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
                                <p style={{ margin: 0 }}>No audit entries match the current filters.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ background: '#F9FAFB' }}>
                                                {['Timestamp', 'Table', 'Record', 'Action', 'Changed By', 'Role', 'Reason', 'IP', 'Hash', ''].map(h => (
                                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r: AuditRow) => <AuditTableRow key={r.audit_id} row={r} />)}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #F3F4F6' }}>
                                    <span style={{ fontSize: 13, color: '#9CA3AF' }}>{totalCount} total entries (showing page {filters.page})</span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} disabled={filters.page === 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Prev</button>
                                        <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} disabled={rows.length < 50} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next →</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ── Electronic Signatures Tab ─────────────────────────────────── */}
            {activeTab === 'Electronic Signatures' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><CheckCircle size={16} /> Electronic Signatures (21 CFR § 11)</h3>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>All cryptographic signatures recorded in the system</span>
                    </div>
                    {signatures.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>No electronic signatures recorded yet.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#F9FAFB' }}>
                                        {['ID', 'Signatory', 'Document Type', 'Document ID', 'Reason', 'Signed At', 'Hash'].map(h => (
                                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {signatures.map((s, i) => (
                                        <tr key={s.signature_id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>#{s.signature_id}</td>
                                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.signatory_username ?? '—'}</td>
                                            <td style={{ padding: '10px 12px' }}><span style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{s.document_type}</span></td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>#{s.document_id}</td>
                                            <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.signing_reason}>{s.signing_reason}</td>
                                            <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(s.signed_at).toLocaleString()}</td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{s.signature_hash?.slice(0, 20)}…</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
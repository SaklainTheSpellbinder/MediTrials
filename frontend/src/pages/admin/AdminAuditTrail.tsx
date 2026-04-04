import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query'; // <-- IMPORT ADDED HERE
import { adminAPI } from '../../services/api';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';

const TABLES = ['users', 'clinical_trials', 'study_sites', 'data_locks', 'study_protocols', 'patients', 'adverse_events', 'lab_results', 'ecrf_data'];
const ACTIONS = ['INSERT', 'UPDATE', 'DELETE'];
const actionColor: Record<string, string> = { INSERT: '#10B981', UPDATE: '#3B82F6', DELETE: '#DC2626' };

// --- Sub-component for Expandable Rows ---
function AuditRow({ r }: { r: any }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <tr onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '9px 10px', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
                    {new Date(r.change_timestamp).toLocaleString()}
                </td>
                <td style={{ padding: '9px 10px' }}>
                    <span className="admin-badge admin-badge-gray" style={{ fontSize: 10 }}>{r.table_name}</span>
                </td>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11 }}>#{r.record_id}</td>
                <td style={{ padding: '9px 10px' }}>
                    <span style={{ color: actionColor[r.action_type] ?? '#6B7280', fontWeight: 700, fontSize: 12 }}>{r.action_type}</span>
                </td>
                <td style={{ padding: '9px 10px', fontWeight: 600, fontSize: 12 }}>{r.changed_by ?? '—'}</td>
                <td style={{ padding: '9px 10px', color: '#6B7280', fontSize: 12 }}>{r.change_reason}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF' }}>{r.ip_address ?? '—'}</td>
            </tr>
            {open && (
                <tr>
                    <td colSpan={7} style={{ padding: '0 10px 10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {r.old_value && (
                                <div>
                                    <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>OLD VALUES</p>
                                    <pre style={{ background: '#FEE2E2', borderRadius: 6, padding: 8, fontSize: 11, overflow: 'auto', maxHeight: 200 }}>
                                        {JSON.stringify(r.old_value, null, 2)}
                                    </pre>
                                </div>
                            )}
                            {r.new_value && (
                                <div>
                                    <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>NEW VALUES</p>
                                    <pre style={{ background: '#D1FAE5', borderRadius: 6, padding: 8, fontSize: 11, overflow: 'auto', maxHeight: 200 }}>
                                        {JSON.stringify(r.new_value, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// --- Main Component ---
export const AdminAuditTrail: React.FC = () => {
    const [filters, setFilters] = useState({ 
        table_name: '', action_type: '', date_from: '', date_to: '', admin_only: false, page: 1, limit: 50 
    });

    // Added <any[]> type definition and used the v5 placeholderData syntax
    const { data: rows = [], isLoading, isFetching } = useQuery<any[]>({
        queryKey: ['admin', 'audit', filters],
        queryFn: () => adminAPI.getAuditLogs({ 
            ...filters, 
            admin_only: filters.admin_only ? 'true' : 'false' 
        }),
        placeholderData: keepPreviousData, // <-- THIS FIXES IT FOR V5
    });

    const F = (label: string, child: React.ReactNode) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</label>
            {child}
        </div>
    );
    
    const sel = (style?: React.CSSProperties) => ({ 
        border: '1px solid #E5E7EB', 
        borderRadius: 6, 
        padding: '6px 10px', 
        fontSize: 13, 
        ...style 
    });

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">Audit Trail</h1>
                {isFetching && !isLoading && <span style={{ fontSize: 12, color: '#6B7280' }}>Loading page...</span>}
            </div>

            <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {F('Table', 
                        <select value={filters.table_name} onChange={e => setFilters(f => ({ ...f, table_name: e.target.value, page: 1 }))} style={sel()}>
                            <option value="">All tables</option>
                            {TABLES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    )}
                    {F('Action', 
                        <select value={filters.action_type} onChange={e => setFilters(f => ({ ...f, action_type: e.target.value, page: 1 }))} style={sel()}>
                            <option value="">All actions</option>
                            {ACTIONS.map(a => <option key={a}>{a}</option>)}
                        </select>
                    )}
                    {F('From', 
                        <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value, page: 1 }))} style={sel()} />
                    )}
                    {F('To', 
                        <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value, page: 1 }))} style={sel()} />
                    )}
                    {F('Rows per page', 
                        <select value={filters.limit} onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value), page: 1 }))} style={sel()}>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                        </select>
                    )}
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, paddingBottom: 8, marginLeft: 8 }}>
                        <input type="checkbox" checked={filters.admin_only} onChange={e => setFilters(f => ({ ...f, admin_only: e.target.checked, page: 1 }))} /> 
                        Admin actions only
                    </label>
                </div>
            </div>

            <div className="card" style={{ position: 'relative' }}>
                {isLoading ? <div className="sm-empty">Loading audit logs…</div> : rows.length === 0 ? (
                    <div className="sm-empty">No audit entries match filters.</div>
                ) : (
                    <div style={{ overflowX: 'auto', opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Timestamp', 'Table', 'Record', 'Action', 'Changed By', 'Reason', 'IP'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => <AuditRow key={r.audit_id} r={r} />)}
                            </tbody>
                        </table>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px 0', marginTop: 12, borderTop: '1px solid #F3F4F6' }}>
                            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Showing up to {filters.limit} records</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button 
                                    onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} 
                                    disabled={filters.page === 1 || isFetching} 
                                    className="btn-secondary" 
                                    style={{ padding: '4px 12px' }}
                                >
                                    ← Prev
                                </button>
                                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Page {filters.page}</span>
                                <button 
                                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} 
                                    disabled={rows.length < filters.limit || isFetching} 
                                    className="btn-secondary" 
                                    style={{ padding: '4px 12px' }}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
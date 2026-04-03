import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Archive, Search } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';
import { adminAPI } from '../../services/api';


export interface AdminTrial {
    trial_id: number;
    trial_nct_id: string;
    trial_title: string;
    trial_phase: string;
    therapeutic_area: string;
    trial_status: string;
    start_date: string | null;
    target_enrollment: number;
    current_enrollment: number | string;
    site_count: number | string;
}


const STATUS_OPTS = ['', 'Planning', 'Recruiting', 'Active', 'Paused', 'Completed', 'Archived'];
const PHASE_OPTS = ['', 'Phase I', 'Phase II', 'Phase III', 'Phase IV', 'N/A'];
const statusColor: Record<string, string> = { 
    Active: 'admin-badge-green', 
    Recruiting: 'admin-badge-blue', 
    Completed: 'admin-badge-gray', 
    Paused: 'admin-badge-amber', 
    Archived: 'admin-badge-red', 
    Planning: 'admin-badge-purple' 
};

export const TrialManagement: React.FC = () => {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [search, setSearch] = useState('');

    const { data: trials = [], isLoading } = useQuery<AdminTrial[]>({
        queryKey: ['admin', 'trials'],
        queryFn: () => adminAPI.getTrials(),
    });

    const archive = useMutation({
        mutationFn: (id: number) => adminAPI.archiveTrial(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'trials'] }),
    });

    const filtered = trials.filter((t) => {
        if (filterStatus && t.trial_status !== filterStatus) return false;
        if (filterPhase && t.trial_phase !== filterPhase) return false;
        if (search && !t.trial_title.toLowerCase().includes(search.toLowerCase()) && !t.trial_nct_id?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">Trial Management</h1>
                <Link to="/admin/trials/new" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> New Trial
                </Link>
            </div>

            {/* Filter bar */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                        <input placeholder="Search title or NCT ID…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 30, width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px 6px 28px', fontSize: 13 }} />
                    </div>
                    <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                        {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
                    </select>
                    <select className="form-select" value={filterPhase} onChange={e => setFilterPhase(e.target.value)} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                        {PHASE_OPTS.map(p => <option key={p} value={p}>{p || 'All phases'}</option>)}
                    </select>
                </div>
            </div>

            <div className="card">
                {isLoading ? <div className="sm-empty">Loading…</div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['NCT ID', 'Title', 'Phase', 'Area', 'Status', 'Start', 'Target', 'Enrolled', 'Sites', 'Actions'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>No trials found</td></tr>
                                ) : filtered.map((t) => (
                                    <tr key={t.trial_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/trials/${t.trial_id}`)}>
                                        <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{t.trial_nct_id}</td>
                                        <td style={{ padding: '9px 10px', fontWeight: 600, color: '#111827', maxWidth: 200 }}>{t.trial_title}</td>
                                        <td style={{ padding: '9px 10px' }}><span className="admin-badge admin-badge-gray">{t.trial_phase}</span></td>
                                        <td style={{ padding: '9px 10px', color: '#6B7280', fontSize: 12 }}>{t.therapeutic_area}</td>
                                        <td style={{ padding: '9px 10px' }}><span className={`admin-badge ${statusColor[t.trial_status] ?? 'admin-badge-gray'}`}>{t.trial_status}</span></td>
                                        <td style={{ padding: '9px 10px', fontSize: 12, color: '#6B7280' }}>{t.start_date?.split('T')[0]}</td>
                                        <td style={{ padding: '9px 10px' }}>{t.target_enrollment}</td>
                                        <td style={{ padding: '9px 10px' }}>{parseInt(String(t.current_enrollment ?? 0))}</td>
                                        <td style={{ padding: '9px 10px' }}>{t.site_count}</td>
                                        <td style={{ padding: '9px 10px' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <Link to={`/admin/trials/${t.trial_id}/edit`} className="admin-act-btn" style={{ textDecoration: 'none' }}><Edit2 size={12} /></Link>
                                                <button onClick={() => { if (window.confirm(`Archive "${t.trial_title}"?`)) archive.mutate(t.trial_id); }}
                                                    className="admin-act-btn" style={{ color: '#DC2626' }}><Archive size={12} /></button>
                                            </div>
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
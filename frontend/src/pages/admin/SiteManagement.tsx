import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';
import { adminAPI } from '../../services/api';

export interface AdminSite {
    site_id: number;
    trial_id: number;
    institution_name: string;
    country: string;
    site_status: string;
    target_enrollment: number;
    current_enrollment: number;
    enrollment_pct: string | number;
    pi_name: string | null;
}

const statusColor: Record<string, string> = { 
    Active: '#10B981', 
    Suspended: '#DC2626', 
    Closed: '#6B7280', 
    Initiated: '#3B82F6' 
};

export const SiteManagement: React.FC = () => {
    const navigate = useNavigate();
    const [trialFilter, setTrialFilter] = useState('');
    const [search, setSearch] = useState('');

    const { data: sites = [], isLoading } = useQuery<AdminSite[]>({
        queryKey: ['admin', 'sites', trialFilter],
        queryFn: () => adminAPI.getSites({ trial_id: trialFilter || undefined }),
    });

    const filtered = sites.filter((s) =>
        !search || 
        s.institution_name.toLowerCase().includes(search.toLowerCase()) || 
        s.country?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">Site Management</h1>
            </div>
            
            {/* Filter Bar */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                        <input 
                            placeholder="Search site or country…" 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 30, width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px 6px 28px', fontSize: 13 }} 
                        />
                    </div>
                    <input 
                        placeholder="Filter by Trial ID…" 
                        value={trialFilter} 
                        onChange={e => setTrialFilter(e.target.value)}
                        style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 160 }} 
                    />
                </div>
            </div>

            {/* Sites Table */}
            <div className="card">
                {isLoading ? <div className="sm-empty">Loading sites…</div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Institution', 'Country', 'Trial', 'Status', 'Target', 'Enrolled', '%', 'PI', 'Actions'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>No sites found</td></tr>
                                ) : filtered.map((s) => {
                                    const pct = parseFloat(String(s.enrollment_pct ?? 0));
                                    return (
                                        <tr key={`${s.site_id}-${s.trial_id}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/sites/${s.site_id}`)}>
                                            <td style={{ padding: '9px 10px', fontWeight: 600 }}>{s.institution_name}</td>
                                            <td style={{ padding: '9px 10px', color: '#6B7280' }}>{s.country}</td>
                                            <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11 }}>#{s.trial_id}</td>
                                            <td style={{ padding: '9px 10px' }}>
                                                <span style={{ color: statusColor[s.site_status] ?? '#6B7280', fontWeight: 600, fontSize: 12 }}>{s.site_status}</span>
                                            </td>
                                            <td style={{ padding: '9px 10px' }}>{s.target_enrollment}</td>
                                            <td style={{ padding: '9px 10px' }}>{s.current_enrollment}</td>
                                            <td style={{ padding: '9px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 60, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ 
                                                            height: '100%', 
                                                            width: `${Math.min(100, pct)}%`, 
                                                            background: pct >= 80 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B', 
                                                            borderRadius: 3 
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: 11 }}>{pct}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '9px 10px', fontSize: 12, color: '#6B7280' }}>{s.pi_name ?? '—'}</td>
                                            <td style={{ padding: '9px 10px' }} onClick={e => e.stopPropagation()}>
                                                <Link to={`/admin/sites/${s.site_id}`} className="admin-act-btn" style={{ fontSize: 11, textDecoration: 'none' }}>Details</Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
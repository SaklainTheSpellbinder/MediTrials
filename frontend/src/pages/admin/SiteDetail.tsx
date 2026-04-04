import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Edit2, AlertTriangle } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';
import { adminAPI } from '../../services/api';

export interface SiteDetailResponse {
    site: {
        site_id: number;
        institution_name: string;
        country: string;
        site_status: string;
    };
    enrollment?: {
        target_enrollment: number;
        current_enrollment: number;
        enrollment_pct: string | number;
        active_patients: number;
        enrolled_patients: number;
        screen_failures: number;
        withdrawn_patients: number;
    };
    performance?: {
        screen_fail_rate: string | number;
        average_screening_days: string | number;
        protocol_deviations_count: number;
    };
    users?: Array<{
        user_id: number;
        username: string;
        email: string;
        role: string;
        last_login: string | null;
        is_active: boolean;
    }>;
    queryResolution?: {
        total_queries: number;
        open_queries: number;
        resolved_queries: number;
        avg_days_to_resolve: string | number;
        median_days_to_resolve: string | number;
    };
}

export const SiteDetail: React.FC = () => {
    const { siteId } = useParams<{ siteId: string }>();
    const qc = useQueryClient();
    const [suspendReason, setSuspendReason] = useState('');
    const [showSuspend, setShowSuspend] = useState(false);

    const { data, isLoading } = useQuery<SiteDetailResponse>({
        queryKey: ['admin', 'site', siteId],
        queryFn: () => adminAPI.getSiteDetails(siteId!),
        enabled: !!siteId,
    });

    const suspend = useMutation({
        mutationFn: () => adminAPI.suspendSite(siteId!, { reason: suspendReason }),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['admin', 'site', siteId] }); 
            setShowSuspend(false); 
            setSuspendReason('');
        },
    });

    if (isLoading) return <div className="dashboard-container"><div className="sm-loading">Loading site data…</div></div>;
    if (!data || !data.site) return <div className="dashboard-container"><div className="sm-error">Site not found.</div></div>;

    const { site, enrollment, performance, users, queryResolution } = data;
    const pct = parseFloat(String(enrollment?.enrollment_pct ?? 0));
    const qdays = parseFloat(String(queryResolution?.avg_days_to_resolve ?? 0));

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">{site.institution_name}</h1>
                    <span style={{ color: '#6B7280', fontSize: 13 }}>{site.country} · {site.site_status}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/admin/sites/${siteId}/edit`} className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Edit2 size={14} /> Edit
                    </Link>
                    <button onClick={() => setShowSuspend(true)} className="btn-secondary" style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} /> Suspend
                    </button>
                </div>
            </div>

            {/* Suspend modal */}
            {showSuspend && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 400 }}>
                        <h3 style={{ marginBottom: 12 }}>Suspend Site</h3>
                        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>Provide a reason for suspension (required for audit trail):</p>
                        <textarea 
                            value={suspendReason} 
                            onChange={e => setSuspendReason(e.target.value)} 
                            rows={3}
                            placeholder="Reason for suspending this site..."
                            style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 12, resize: 'none' }} 
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => suspend.mutate()} disabled={!suspendReason || suspend.isPending} className="btn-primary" style={{ background: '#DC2626' }}>
                                {suspend.isPending ? 'Suspending...' : 'Confirm Suspend'}
                            </button>
                            <button onClick={() => { setShowSuspend(false); setSuspendReason(''); }} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Section 1 — Enrollment */}
                <div className="card">
                    <h3 className="card-title">Enrollment</h3>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 22 }}>{enrollment?.current_enrollment ?? 0}</span>
                            <span style={{ color: '#9CA3AF', fontSize: 13 }}>of {enrollment?.target_enrollment ?? 0}</span>
                        </div>
                        <div style={{ height: 12, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct >= 80 ? '#10B981' : '#3B82F6', borderRadius: 6 }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>{pct}% enrolled</span>
                    </div>
                    {[
                        ['Active', enrollment?.active_patients], 
                        ['Enrolled', enrollment?.enrolled_patients], 
                        ['Screen Failures', enrollment?.screen_failures], 
                        ['Withdrawn', enrollment?.withdrawn_patients]
                    ].map(([k, v]) => (
                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                            <span style={{ color: '#6B7280' }}>{k}</span><span style={{ fontWeight: 700 }}>{v ?? 0}</span>
                        </div>
                    ))}
                </div>

                {/* Section 2 — Performance */}
                <div className="card">
                    <h3 className="card-title">Performance</h3>
                    {[
                        ['Screen Fail Rate', `${performance?.screen_fail_rate ?? '—'}%`],
                        ['Avg Screening Days', performance?.average_screening_days ?? '—'],
                        ['Protocol Deviations', performance?.protocol_deviations_count ?? '—'],
                        ['Query Resolution', `${qdays} days`],
                    ].map(([k, v]) => (
                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F9FAFB', fontSize: 13 }}>
                            <span style={{ color: '#6B7280' }}>{k}</span>
                            <span style={{ fontWeight: 700, color: k === 'Query Resolution' ? (qdays > 10 ? '#DC2626' : qdays > 5 ? '#D97706' : '#10B981') : '#111827' }}>{v}</span>
                        </div>
                    ))}
                </div>

                {/* Section 3 — Users */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 className="card-title">Users at this Site</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>
                                    {['Username', 'Email', 'Role', 'Last Login', 'Active', 'Actions'].map(h => (
                                        <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {!users || users.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#9CA3AF' }}>No users at this site</td></tr>
                                ) : users.map((u) => (
                                    <tr key={u.user_id}>
                                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{u.username}</td>
                                        <td style={{ padding: '8px 10px', color: '#6B7280', fontSize: 12 }}>{u.email}</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <span className="admin-badge admin-badge-gray" style={{ fontSize: 10 }}>{u.role?.replace('_', ' ')}</span>
                                        </td>
                                        <td style={{ padding: '8px 10px', color: '#6B7280', fontSize: 12 }}>
                                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>{u.is_active ? '✓' : '✗'}</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <Link to={`/admin/users/${u.user_id}`} className="admin-act-btn" style={{ fontSize: 11, textDecoration: 'none' }}>Manage</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 4 — Query Resolution */}
                {queryResolution && (
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                        <h3 className="card-title">Query Resolution</h3>
                        {[
                            ['Total Queries', queryResolution.total_queries], 
                            ['Open Queries', queryResolution.open_queries], 
                            ['Resolved Queries', queryResolution.resolved_queries], 
                            ['Avg Days to Resolve', queryResolution.avg_days_to_resolve], 
                            ['Median Days', queryResolution.median_days_to_resolve]
                        ].map(([k, v]) => (
                            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #F9FAFB' }}>
                                <span style={{ color: '#6B7280' }}>{k}</span>
                                <span style={{ fontWeight: 700 }}>{v ?? '—'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';

const adminApi = axios.create({ baseURL: 'http://localhost:5000' });
adminApi.interceptors.request.use(cfg => { const raw = localStorage.getItem('user'); if (raw) cfg.headers['X-User-Data'] = btoa(raw); return cfg; });

export const UserAccessLog: React.FC = () => {
    const { userId } = useParams();

    const { data: log = [], isLoading } = useQuery({
        queryKey: ['admin', 'user-log', userId],
        queryFn: () => adminApi.get(`/api/admin/users/${userId}/access-log`).then(r => r.data),
    });

    const { data: users = [] } = useQuery({
        queryKey: ['admin', 'users', {}],
        queryFn: () => adminApi.get('/api/admin/users').then(r => r.data),
    });
    const user = users.find((u: any) => String(u.user_id) === String(userId));

    const exportCsv = () => {
        const header = 'Timestamp,IP Address,Action,Resource,Status\n';
        const rows = log.map((r: any) => `"${r.access_time}","${r.ip_address}","${r.action_type}","${r.resource}","${r.status}"`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `access_log_user_${userId}.csv`; a.click();
    };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Link to="/admin/users" style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, textDecoration: 'none' }}><ArrowLeft size={14} /> Users</Link>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>
                        Access Log{user ? ` — ${user.username}` : ''}
                        {user && <span className="admin-badge admin-badge-gray" style={{ marginLeft: 8, fontSize: 11 }}>{user.role?.replace(/_/g, ' ')}</span>}
                    </h1>
                </div>
                <button onClick={exportCsv} className="btn-secondary"><Download size={14} /> Export CSV</button>
            </div>

            <div className="card">
                {isLoading ? <div className="sm-empty">Loading…</div> : log.length === 0 ? (
                    <div className="sm-empty">No access log entries found.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Timestamp', 'IP Address', 'Action', 'Resource', 'Status'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {log.map((r: any, i: number) => (
                                    <tr key={i}>
                                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(r.access_time).toLocaleString()}</td>
                                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.ip_address}</td>
                                        <td style={{ padding: '8px 12px' }}><span className="admin-badge" style={{ background: r.action_type === 'LOGIN' ? '#D1FAE5' : '#F3F4F6', color: r.action_type === 'LOGIN' ? '#065F46' : '#374151', fontSize: 10 }}>{r.action_type}</span></td>
                                        <td style={{ padding: '8px 12px', color: '#6B7280', fontSize: 12 }}>{r.resource}</td>
                                        <td style={{ padding: '8px 12px' }}><span style={{ color: r.status === 'SUCCESS' ? '#10B981' : '#DC2626', fontWeight: 600, fontSize: 12 }}>{r.status}</span></td>
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

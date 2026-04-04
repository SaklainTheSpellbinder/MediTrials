import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { adminAPI } from '../../services/api'; 
import '../Dashboard.css';
import '../admin/AdminDashboard.css';

export const UserAccessLog: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();

    const { data: log = [], isLoading } = useQuery({
        queryKey: ['admin', 'user-log', userId],
        queryFn: () => adminAPI.getUserAccessLog(userId!),
        enabled: !!userId,
    });

    const { data: users = [] } = useQuery({
        queryKey: ['admin', 'users', {}],
        queryFn: () => adminAPI.getUsers(),
    });
    
    const user = users.find((u: any) => String(u.user_id) === String(userId));

    const exportCsv = () => {
        const header = 'Timestamp,IP Address,Action,Resource,Status\n';
        const rows = log.map((r: any) => {
            const status = r.access_type?.includes('FAILED') ? 'FAILED' : 'SUCCESS';
            const resource = `${r.accessed_table || ''} ${r.accessed_record_id ? `(#${r.accessed_record_id})` : ''}`.trim();
            return `"${r.access_timestamp}","${r.ip_address || ''}","${r.access_type}","${resource}","${status}"`;
        }).join('\n');
        
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `access_log_user_${userId}.csv`; 
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Link to="/admin/users" style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, textDecoration: 'none' }}>
                        <ArrowLeft size={14} /> Users
                    </Link>
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
                                {log.map((r: any) => {
                                    const isFailed = r.access_type?.includes('FAILED');
                                    const status = isFailed ? 'FAILED' : 'SUCCESS';
                                    const isLogin = r.access_type === 'LOGIN';
                                    const badgeBg = isLogin ? '#D1FAE5' : isFailed ? '#FEE2E2' : '#F3F4F6';
                                    const badgeColor = isLogin ? '#065F46' : isFailed ? '#991B1B' : '#374151';
                                    const resource = `${r.accessed_table || '—'} ${r.accessed_record_id ? `(#${r.accessed_record_id})` : ''}`.trim();

                                    return (
                                        <tr key={r.log_id}>
                                            <td style={{ padding: '8px 12px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                                                {new Date(r.access_timestamp).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                                                {r.ip_address || '—'}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span className="admin-badge" style={{ background: badgeBg, color: badgeColor, fontSize: 10 }}>
                                                    {r.access_type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 12px', color: '#6B7280', fontSize: 12 }}>
                                                {resource}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{ color: status === 'SUCCESS' ? '#10B981' : '#DC2626', fontWeight: 600, fontSize: 12 }}>
                                                    {status}
                                                </span>
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
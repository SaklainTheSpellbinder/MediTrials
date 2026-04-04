import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/dashboard/StatCard';
import { Link } from 'react-router-dom';
import {
    Activity, Users, Database, AlertCircle, Shield,
    CheckCircle, XCircle, BarChart2, RefreshCw
} from 'lucide-react';
import '../Dashboard.css';
import './AdminDashboard.css';
import { adminAPI } from '../../services/api';


export interface TrialPortfolioItem {
    trial_id: number;
    trial_nct_id: string;
    trial_status: string;
    trial_phase: string;
    trial_title: string;
    enrollmentPct: string | number;
    currentEnrollment: number;
    target_enrollment: number | null;
    site_count: number;
    enrollmentVelocity: string | number | null;
    projectedCompletion: string | null;
    activeAlerts: number;
    totalSae: number;
    criticalDeviations: number;
}

export interface AuditItemData {
    audit_id: number;
    change_timestamp: string;
    table_name: string;
    action_type: string;
    changed_by: string;
    change_reason: string;
    new_values?: any;
}

export interface UserActivityData {
    logged_in_today: number | string;
    logged_in_7d: number | string;
    inactive_users: number | string;
    failed_logins_24h: number | string;
}

export interface DataQualitySummary {
    trial_id: number;
    total_patients: number;
    signed_pct: string | number;
    total_open_queries: string | number;
}

export interface AdminDashboardData {
    activeTrials: number;
    activeUsers: number;
    totalPatients: number;
    unacknowledgedCritical: number;
    trialPortfolio: TrialPortfolioItem[];
    recentAdminActivity: AuditItemData[];
    userActivity: UserActivityData;
    activeLocks: number;
    dataQualitySummary: DataQualitySummary[];
}

const statusColor: Record<string, string> = {
    Active: 'admin-badge-green', Recruiting: 'admin-badge-blue',
    Completed: 'admin-badge-gray', Paused: 'admin-badge-amber',
    Archived: 'admin-badge-red', Planning: 'admin-badge-purple',
};
const actionColor: Record<string, string> = { INSERT: '#10B981', UPDATE: '#3B82F6', DELETE: '#DC2626' };

// ── Trial Portfolio Card ──────────────────────────────────────────────────────
const TrialCard: React.FC<{ t: TrialPortfolioItem }> = ({ t }) => {
    const pct = Math.min(100, parseFloat(String(t.enrollmentPct)) || 0);
    const barColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B';
    return (
        <div className="admin-trial-card">
            <div className="admin-trial-header">
                <div>
                    <span className="admin-trial-nct">{t.trial_nct_id}</span>
                    <span className={`admin-badge ${statusColor[t.trial_status] ?? 'admin-badge-gray'}`}>{t.trial_status}</span>
                </div>
                <span className="admin-trial-phase">{t.trial_phase}</span>
            </div>
            <h3 className="admin-trial-title">{t.trial_title}</h3>
            <div className="admin-trial-bar-wrap">
                <div className="admin-trial-bar-track">
                    <div className="admin-trial-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <span className="admin-trial-bar-label">{pct}% ({t.currentEnrollment}/{t.target_enrollment || '?'})</span>
            </div>
            <div className="admin-trial-meta">
                <span>🏥 {t.site_count} sites</span>
                {t.enrollmentVelocity != null && <span>📈 {parseFloat(String(t.enrollmentVelocity)).toFixed(1)} pts/wk</span>}
                {t.projectedCompletion && <span>🗓 {String(t.projectedCompletion).split('T')[0]}</span>}
            </div>
            <div className="admin-trial-safety">
                <span className={t.activeAlerts > 0 ? 'admin-safety-red' : 'admin-safety-ok'}>
                    🔔 {t.activeAlerts} alerts
                </span>
                <span>🧪 {t.totalSae} SAEs</span>
                <span className={t.criticalDeviations > 0 ? 'admin-safety-red' : 'admin-safety-ok'}>
                    ⚠️ {t.criticalDeviations} crit. dev.
                </span>
            </div>
            <div className="admin-trial-actions">
                <Link to={`/admin/trials/${t.trial_id}/edit`} className="admin-act-btn" style={{ textDecoration: 'none' }}>Edit Trial</Link>
                <Link to={`/admin/sites?trial_id=${t.trial_id}`} className="admin-act-btn" style={{ textDecoration: 'none' }}>View Sites</Link>
                <Link to={`/admin/trials/${t.trial_id}`} className="admin-act-btn admin-act-primary" style={{ textDecoration: 'none' }}>Details</Link>
            </div>
        </div>
    );
};

// ── Audit item ────────────────────────────────────────────────────────────────
const AuditItem: React.FC<{ r: AuditItemData }> = ({ r }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="admin-audit-item" onClick={() => setOpen(o => !o)}>
            <div className="admin-audit-row">
                <span className="admin-audit-time">{new Date(r.change_timestamp).toLocaleString()}</span>
                <span className="admin-badge admin-badge-gray" style={{ fontSize: 10 }}>{r.table_name}</span>
                <span style={{ color: actionColor[r.action_type] ?? '#6B7280', fontWeight: 600, fontSize: 11 }}>{r.action_type}</span>
                <span className="admin-audit-user">{r.changed_by}</span>
                <span className="admin-audit-reason">{r.change_reason}</span>
            </div>
            {open && r.new_values && (
                <pre className="admin-audit-json">{JSON.stringify(r.new_values, null, 2)}</pre>
            )}
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const qc = useQueryClient();

    const { data, isLoading, isError } = useQuery<AdminDashboardData>({
        queryKey: ['dashboard', 'admin'],
        queryFn: () => adminAPI.getDashboard(),
        refetchInterval: 60000,
    });

    const refreshMV = useMutation({
        mutationFn: () => adminAPI.refreshMVs(),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'admin'] }),
    });

    if (isLoading) return <div className="dashboard-container"><div className="sm-loading"><BarChart2 size={32} className="sm-spin" /><p>Loading admin data…</p></div></div>;
    if (isError || !data) return <div className="dashboard-container"><div className="sm-error"><AlertCircle size={32} /><p>Failed to load admin dashboard.</p></div></div>;

    const ua = data.userActivity;

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">System Admin Dashboard</h1>
                    <p className="text-gray-500 text-sm">Welcome, {user?.full_name} · Admin · Refreshes every 60s</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => refreshMV.mutate()} disabled={refreshMV.isPending} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} className={refreshMV.isPending ? 'sm-spin' : ''} /> Refresh MVs
                    </button>
                    <Link to="/admin/trials/new" className="btn-primary" style={{ textDecoration: 'none' }}>+ New Trial</Link>
                    <Link to="/admin/users" className="btn-primary" style={{ textDecoration: 'none' }}>+ New User</Link>
                </div>
            </div>

            {/* ROW 1 — 4 KPI cards */}
            <div className="stats-grid">
                <StatCard label="Active Trials" value={data.activeTrials} icon={Activity} color="info" subValue="Currently running" />
                <StatCard label="Active Users" value={data.activeUsers} icon={Users} color="success" subValue={`${ua?.logged_in_today ?? 0} logged in today`} />
                <StatCard label="Total Patients" value={data.totalPatients} icon={Database} color="info" subValue="Across all trials" />
                <StatCard label="Unacknowledged Critical" value={data.unacknowledgedCritical} icon={AlertCircle}
                    color={data.unacknowledgedCritical > 0 ? 'danger' : 'success'} subValue=">1 hour old, needs action" />
            </div>

            {/* ROW 2 — Trial Portfolio */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Shield size={18} /> Trial Portfolio</h3>
                    <Link to="/admin/trials" className="sm-link" style={{ textDecoration: 'none' }}>Manage All Trials →</Link>
                </div>
                <div className="admin-trial-grid">
                    {data.trialPortfolio?.length === 0 ? (
                        <div className="sm-empty">No trials found. <Link to="/admin/trials/new" style={{ textDecoration: 'none' }}>Create one →</Link></div>
                    ) : data.trialPortfolio?.map((t) => <TrialCard key={t.trial_id} t={t} />)}
                </div>
            </div>

            {/* ROW 3 — 60/40 */}
            <div className="admin-row3">
                {/* Left: Recent Admin Activity */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Activity size={18} /> Recent Admin Activity</h3>
                        <Link to="/audit" className="sm-link" style={{ textDecoration: 'none' }}>Full Audit Trail →</Link>
                    </div>
                    <div className="admin-audit-list">
                        {data.recentAdminActivity?.length === 0 ? (
                            <div className="sm-empty">No admin actions recorded yet.</div>
                        ) : data.recentAdminActivity?.map((r) => <AuditItem key={r.audit_id} r={r} />)}
                    </div>
                </div>

                {/* Right: User Activity */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Users size={18} /> User Activity &amp; Security</h3>
                        <Link to="/admin/users" className="sm-link" style={{ textDecoration: 'none' }}>Manage Users →</Link>
                    </div>
                    <div className="admin-user-stats">
                        <div className="admin-user-stat-row">
                            <CheckCircle size={16} color="#10B981" /><span>Logged in today</span>
                            <span className="admin-user-val">{ua?.logged_in_today ?? 0}</span>
                        </div>
                        <div className="admin-user-stat-row">
                            <CheckCircle size={16} color="#3B82F6" /><span>Logged in this week</span>
                            <span className="admin-user-val">{ua?.logged_in_7d ?? 0}</span>
                        </div>
                        <div className="admin-user-stat-row">
                            <XCircle size={16} color={parseInt(String(ua?.inactive_users)) > 0 ? '#F59E0B' : '#D1D5DB'} />
                            <span>Inactive &gt;90 days</span>
                            <span className="admin-user-val" style={{ color: parseInt(String(ua?.inactive_users)) > 0 ? '#F59E0B' : undefined }}>{ua?.inactive_users ?? 0}</span>
                        </div>
                        <div className="admin-user-stat-row">
                            <AlertCircle size={16} color={parseInt(String(ua?.failed_logins_24h)) > 0 ? '#DC2626' : '#D1D5DB'} />
                            <span>Failed logins (24 h)</span>
                            <span className="admin-user-val" style={{ color: parseInt(String(ua?.failed_logins_24h)) > 0 ? '#DC2626' : undefined }}>{ua?.failed_logins_24h ?? 0}</span>
                        </div>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                        <div className="admin-lock-stat">
                            <Shield size={16} color="#6B7280" /> <span>Active Data Locks</span>
                            <span className="admin-user-val">{data.activeLocks}</span>
                        </div>
                    </div>
                    <Link to="/admin/locks" className="admin-link-block" style={{ textDecoration: 'none' }}>View Lock Management →</Link>
                </div>
            </div>

            {/* ROW 4 — Data Quality */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><BarChart2 size={18} /> Data Quality Overview</h3>
                </div>
                <table className="admin-dq-table">
                    <thead><tr><th>Trial</th><th>Patients</th><th>% Signed</th><th>Open Queries</th></tr></thead>
                    <tbody>
                        {data.dataQualitySummary?.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9CA3AF', padding: 14 }}>No data quality data</td></tr>
                        ) : data.dataQualitySummary?.map((r) => {
                            const pct = parseFloat(String(r.signed_pct ?? 0));
                            const oq = parseInt(String(r.total_open_queries ?? 0));
                            return (
                                <tr key={r.trial_id}>
                                    <td>Trial #{r.trial_id}</td>
                                    <td>{r.total_patients}</td>
                                    <td style={{ background: pct >= 80 ? '#D1FAE5' : pct >= 60 ? '#FEF3C7' : '#FEE2E2', fontWeight: 600 }}>
                                        {pct ?? '—'}%
                                    </td>
                                    <td style={{ color: oq > 10 ? '#DC2626' : oq > 0 ? '#D97706' : '#10B981', fontWeight: 600 }}>
                                        {oq}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
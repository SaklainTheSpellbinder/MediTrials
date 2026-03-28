import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/dashboard/StatCard';
import {
    AlertCircle, Clock, BarChart2, FileText, GitBranch,
    TrendingUp, TrendingDown, Minus, Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import '../Dashboard.css';
import './DataManagerDashboard.css';

// ── Axios helper ─────────────────────────────────────────────────────────────
const dmApi = axios.create({ baseURL: 'http://localhost:5000' });
dmApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

// ── Colour helpers ────────────────────────────────────────────────────────────
const resolutionColor = (d: number) => d < 5 ? 'success' : d <= 10 ? 'warning' : 'danger';
const missingColor = (p: number) => p < 2 ? 'success' : p <= 5 ? 'warning' : 'danger';
const openColor = (n: number) => n > 0 ? 'danger' : 'success';
const unsignedColor = (n: number) => n > 0 ? 'warning' : 'success';
const pillClass = (passing: boolean) => passing ? 'dm-pill dm-pill-green' : 'dm-pill dm-pill-amber';

// ── Query Age horizontal bar chart ───────────────────────────────────────────
const QueryAgeChart: React.FC<{ dist: { bucket_0_3: number; bucket_4_7: number; bucket_8_14: number; bucket_14plus: number } }> = ({ dist }) => {
    const rows = [
        { label: '0–3 days', count: dist.bucket_0_3, color: '#10B981' },
        { label: '4–7 days', count: dist.bucket_4_7, color: '#3B82F6' },
        { label: '8–14 days', count: dist.bucket_8_14, color: '#F59E0B' },
        { label: '14+ days', count: dist.bucket_14plus, color: '#DC2626' },
    ];
    const maxVal = Math.max(1, ...rows.map(r => r.count));
    return (
        <div className="dm-age-chart">
            {rows.map(r => (
                <div key={r.label} className="dm-age-row">
                    <span className="dm-age-label">{r.label}</span>
                    <div className="dm-age-track">
                        <div className="dm-age-bar" style={{ width: `${(r.count / maxVal) * 100}%`, background: r.color }} />
                    </div>
                    <span className="dm-age-count">{r.count}</span>
                </div>
            ))}
        </div>
    );
};

// ── Site performance table ────────────────────────────────────────────────────
const SiteTable: React.FC<{ rows: any[] }> = ({ rows }) => {
    const cellColor = (d: number) => d < 5 ? '#D1FAE5' : d <= 10 ? '#FEF3C7' : '#FEE2E2';
    return (
        <div className="dm-site-table-wrap">
            <table className="dm-site-table">
                <thead>
                    <tr>
                        <th>Site</th><th>Open</th><th>Resolved</th><th>Avg Days</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: '#6B7280', padding: 16 }}>No site data</td></tr>
                    ) : rows.map((r, i) => (
                        <tr key={i}>
                            <td className="dm-site-name">{r.institution_name}</td>
                            <td>{r.open_queries}</td>
                            <td>{r.resolved_queries}</td>
                            <td style={{ background: cellColor(parseFloat(r.avg_days_to_resolve)), fontWeight: 600 }}>
                                {parseFloat(r.avg_days_to_resolve).toFixed(1)}d
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── Lock Readiness row ────────────────────────────────────────────────────────
const LockReadinessRow: React.FC<{ t: any }> = ({ t }) => {
    const queriesOk = parseInt(t.open_queries) === 0;
    const unsignedOk = parseInt(t.unsigned_forms) === 0;
    const missingOk = parseFloat(t.missing_data_pct) < 2;
    const devOk = parseInt(t.deviations_undocumented) === 0;
    const readyToLock = queriesOk && unsignedOk && missingOk && devOk && !t.has_active_lock;

    return (
        <div className="dm-lock-row">
            <div className="dm-lock-left">
                <span className="dm-lock-title">{t.trial_title}</span>
                <div className="dm-lock-pills">
                    <span className={pillClass(queriesOk)}>Queries: {t.open_queries} open</span>
                    <span className={pillClass(unsignedOk)}>Unsigned: {t.unsigned_forms}</span>
                    <span className={pillClass(missingOk)}>Missing: {t.missing_data_pct}%</span>
                    <span className={pillClass(devOk)}>Deviations: {t.deviations_undocumented} undoc.</span>
                </div>
            </div>
            <div className="dm-lock-right">
                {t.has_active_lock ? (
                    <span className="dm-badge-locked">🔒 Locked</span>
                ) : readyToLock ? (
                    <Link to="/data-management/lock" className="dm-btn-lock">Ready to Lock →</Link>
                ) : (
                    <span className="dm-badge-unlocked">Unlocked</span>
                )}
            </div>
        </div>
    );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export const DataManagerDashboard: React.FC = () => {
    const { user } = useAuth();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard', 'data-manager'],
        queryFn: () => dmApi.get('/api/dashboard/data-manager').then(r => r.data),
        refetchInterval: 60000,
    });

    if (isLoading) return (
        <div className="dashboard-container">
            <div className="sm-loading"><BarChart2 size={32} className="sm-spin" /><p>Loading data quality metrics…</p></div>
        </div>
    );
    if (isError || !data) return (
        <div className="dashboard-container">
            <div className="sm-error"><AlertCircle size={32} /><p>Failed to load dashboard. Check backend connection.</p></div>
        </div>
    );

    const TrendIcon = data.openQueriesTrend === 'up' ? TrendingUp : data.openQueriesTrend === 'down' ? TrendingDown : Minus;

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Data Manager Dashboard</h1>
                    <p className="text-gray-500 text-sm">Welcome, {user?.full_name} · All trials · Refreshes every 60s</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/data-management/queries" className="btn-secondary">View All Queries</Link>
                    <Link to="/data-management/export" className="btn-primary">Export SDTM</Link>
                </div>
            </div>

            {/* ROW 1 — 5 KPI StatCards */}
            <div className="stats-grid dm-stats-5">
                <StatCard label="Open Queries" value={data.openQueriesTotal} icon={AlertCircle} color={openColor(data.openQueriesTotal)}
                    subValue={`${data.openQueriesTrend === 'up' ? '↑' : data.openQueriesTrend === 'down' ? '↓' : '→'} vs last week`} />
                <StatCard label="Avg Resolution" value={`${data.avgResolutionDays}d`} icon={Clock} color={resolutionColor(data.avgResolutionDays)}
                    subValue="Target: < 5 days" />
                <StatCard label="Missing Data" value={`${data.missingDataRate}%`} icon={GitBranch} color={missingColor(data.missingDataRate)}
                    subValue="Target: < 2%" />
                <StatCard label="Unsigned Forms" value={data.unsignedFormsCount} icon={FileText} color={unsignedColor(data.unsignedFormsCount)}
                    subValue="Awaiting PI signature" />
                <StatCard label="Deviations" value={data.deviationsThisMonth} icon={TrendIcon} color="info"
                    subValue="This month" />
            </div>

            {/* ROW 2 — 50/50 */}
            <div className="dm-row2">
                {/* Left: Query Age Distribution */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><BarChart2 size={18} /> Query Age Breakdown</h3>
                        <span className="dm-subtitle">Longer bars in older buckets = sites need chasing</span>
                    </div>
                    <QueryAgeChart dist={data.queryAgeDistribution} />
                </div>

                {/* Right: Site Query Performance */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><LinkIcon size={18} /> Site Query Performance</h3>
                        <Link to="/data-management/queries" className="sm-link">All Queries →</Link>
                    </div>
                    <SiteTable rows={data.siteQueryComparison} />
                </div>
            </div>

            {/* ROW 3 — Lock Readiness (full width) */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">🔒 Trial Lock Readiness</h3>
                    <Link to="/data-management/lock" className="sm-link">Manage Locks →</Link>
                </div>
                <div className="dm-lock-list">
                    {data.lockReadiness?.length === 0 ? (
                        <div className="sm-empty">No trials found</div>
                    ) : data.lockReadiness?.map((t: any) => (
                        <LockReadinessRow key={t.trial_id} t={t} />
                    ))}
                </div>
            </div>
        </div>
    );
};

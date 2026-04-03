import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/dashboard/StatCard';
import {
    Users, ShieldCheck, Zap, Database, BarChart2,
    Activity, AlertCircle, CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import '../Dashboard.css';
import './StatisticianDashboard.css';
import { statisticsAPI } from '../../services/api';

// --- Type Interfaces ---
interface DashboardData {
    ittPopulation: number;
    perProtocolPopulation: number;
    latestPowerEstimate: { currentPower: number; requiredSampleSize: number } | null;
    analysisDatasets: any[];
    activeLocks: any[];
    enrollmentByTrial: any[];
    recentSurvivalAnalyses: any[];
    randomizationBalance: any[];
}
// ------------------------

// ── Helpers ───────────────────────────────────────────────────────────────────
const powerColor = (p: number) => p >= 0.8 ? 'success' : p >= 0.6 ? 'warning' : 'danger';

const pvalDisplay = (p: string | number | null) => {
    if (p == null) return <span style={{ color: '#9CA3AF' }}>—</span>;
    const num = typeof p === 'string' ? parseFloat(p) : p;
    return <span style={{ fontWeight: num < 0.05 ? 700 : 400, color: num < 0.05 ? '#DC2626' : '#6B7280' }}>{num.toFixed(4)}</span>;
};

const daysAgo = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    return diff === 0 ? 'Today' : `${diff}d ago`;
};

const datasetBadgeClass: Record<string, string> = {
    Safety: 'stat-badge-red', Efficacy: 'stat-badge-blue', ITT: 'stat-badge-green',
    'Per Protocol': 'stat-badge-teal', Exploratory: 'stat-badge-purple',
};

const phaseBadgeClass: Record<string, string> = {
    'Phase I': 'stat-badge-gray', 'Phase II': 'stat-badge-blue', 'Phase III': 'stat-badge-green',
};

// ── Datasets table ────────────────────────────────────────────────────────────
const DatasetsTable: React.FC<{ rows: any[] }> = ({ rows }) => (
    <div className="stat-table-wrap">
        {rows.length === 0 ? (
            <div className="sm-empty">No datasets yet. Lock a database first, then generate datasets.</div>
        ) : (
            <table className="stat-table">
                <thead><tr>
                    <th>Name</th><th>Type</th><th>Trial</th><th>n</th><th>Cutoff</th><th>p</th><th>Sig.</th>
                </tr></thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.dataset_id}>
                            <td className="stat-name">{r.dataset_name}</td>
                            <td><span className={`stat-badge ${datasetBadgeClass[r.dataset_type] ?? 'stat-badge-gray'}`}>{r.dataset_type}</span></td>
                            <td className="stat-trial">{r.trial_title}</td>
                            <td>{r.population_count ?? '—'}</td>
                            <td className="stat-mono">{r.data_cutoff_date?.split('T')[0] ?? '—'}</td>
                            <td>{pvalDisplay(r.p_value)}</td>
                            <td>{r.statistical_significance
                                ? <CheckCircle size={14} color="#10B981" />
                                : <span style={{ color: '#9CA3AF' }}>—</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </div>
);

// ── Enrollment progress bar ───────────────────────────────────────────────────
const EnrollmentBar: React.FC<{ t: any }> = ({ t }) => {
    const pct = Math.min(100, parseFloat(t.enrollment_pct) || 0);
    const color = pct >= 100 ? '#10B981' : pct >= 70 ? '#3B82F6' : '#F59E0B';
    return (
        <div className="stat-enroll-row">
            <div className="stat-enroll-left">
                <span className="stat-enroll-name">{t.trial_title}</span>
                <span className={`stat-badge ${phaseBadgeClass[t.trial_phase] ?? 'stat-badge-gray'}`}>{t.trial_phase}</span>
            </div>
            <div className="stat-enroll-bar-wrap">
                <div className="stat-enroll-track">
                    <div className="stat-enroll-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="stat-enroll-label">{t.current_enrollment} / {t.target_enrollment}</span>
            </div>
            <span className={`stat-badge ${t.trial_status === 'Recruiting' ? 'stat-badge-blue' : t.trial_status === 'Active' ? 'stat-badge-green' : 'stat-badge-gray'}`}>
                {t.trial_status}
            </span>
        </div>
    );
};

// ── Survival analysis list ────────────────────────────────────────────────────
const SurvivalList: React.FC<{ rows: any[] }> = ({ rows }) => (
    <div className="stat-surv-list">
        {rows.length === 0 ? (
            <div className="sm-empty">No survival analyses yet.</div>
        ) : rows.map(r => {
            const pv = parseFloat(r.logrank_p_value);
            return (
                <div key={r.analysis_id} className="stat-surv-item">
                    <div className="stat-surv-top">
                        <span className="stat-surv-endpoint">{r.endpoint_type}</span>
                        <span className="stat-surv-trial">{r.trial_title}</span>
                        <span className="stat-surv-date">{daysAgo(r.calculated_at)}</span>
                    </div>
                    <div className="stat-surv-bottom">
                        <span className="stat-surv-hr">
                            HR = {parseFloat(r.hazard_ratio).toFixed(2)} (95% CI: {r.confidence_interval_95})
                        </span>
                        <span style={{ fontWeight: pv < 0.05 ? 700 : 400, color: pv < 0.05 ? '#DC2626' : '#6B7280' }}>
                            p = {pv.toFixed(4)}
                        </span>
                    </div>
                </div>
            );
        })}
    </div>
);

// ── Randomization Balance ─────────────────────────────────────────────────────
const BalanceTable: React.FC<{ rows: any[] }> = ({ rows }) => {
    const trials = Array.from(new Set(rows.map(r => r.trial_id)));
    return (
        <div className="stat-balance-wrap">
            {rows.length === 0 ? (
                <div className="sm-empty">No randomization data</div>
            ) : trials.map(tid => {
                const trialRows = rows.filter(r => r.trial_id === tid);
                const pctMaleVals = trialRows.map(r => parseFloat(r.pct_male));
                const pctDiff = Math.max(...pctMaleVals) - Math.min(...pctMaleVals);
                const ageDiff = Math.max(...trialRows.map(r => parseFloat(r.avg_age))) - Math.min(...trialRows.map(r => parseFloat(r.avg_age)));
                const imbalanced = pctDiff > 10 || ageDiff > 5;
                return (
                    <div key={String(tid)} className="stat-balance-trial">
                        <div className="stat-balance-title">
                            {trialRows[0]?.trial_title}
                            {imbalanced && <span className="stat-imbalance">⚠️ Imbalance detected</span>}
                        </div>
                        <table className="stat-table">
                            <thead><tr><th>Arm</th><th>n</th><th>Avg Age</th><th>% Male</th></tr></thead>
                            <tbody>
                                {trialRows.map(r => {
                                    const rowWarning = pctDiff > 10 || ageDiff > 5;
                                    return (
                                        <tr key={r.arm_code} style={rowWarning ? { background: '#FFF7ED' } : {}}>
                                            <td className="stat-arm">{r.arm_code}</td>
                                            <td>{r.patient_count}</td>
                                            <td>{parseFloat(r.avg_age).toFixed(1)}</td>
                                            <td>{parseFloat(r.pct_male).toFixed(1)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export const StatisticianDashboard: React.FC = () => {
    const { user } = useAuth();

    const { data, isLoading, isError } = useQuery<DashboardData>({
        queryKey: ['dashboard', 'statistician'],
        queryFn: () => statisticsAPI.getDashboard(),
        refetchInterval: 300000, // 5 min
    });

    if (isLoading) return (
        <div className="dashboard-container">
            <div className="sm-loading"><BarChart2 size={32} className="sm-spin" /><p>Loading statistical data…</p></div>
        </div>
    );
    if (isError || !data) return (
        <div className="dashboard-container">
            <div className="sm-error"><AlertCircle size={32} /><p>Failed to load dashboard.</p></div>
        </div>
    );

    const power = data.latestPowerEstimate;
    const powerPct = power ? (power.currentPower * 100).toFixed(1) + '%' : 'N/A';

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Statistician Dashboard</h1>
                    <p className="text-gray-500 text-sm">Welcome, {user?.full_name} · Read-only · Refreshes every 5 min</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/statistics/datasets" className="btn-secondary" style={{ textDecoration: 'none' }}>Analysis Datasets</Link>
                    <Link to="/statistics/export" className="btn-primary" style={{ textDecoration: 'none' }}>Export SDTM</Link>
                </div>
            </div>

            {/* ROW 1 — 3 KPI cards */}
            <div className="stats-grid">
                <StatCard label="ITT Population" value={data.ittPopulation} icon={Users} color="info" subValue="Intent-to-Treat" />
                <StatCard label="Per Protocol Population" value={data.perProtocolPopulation} icon={ShieldCheck} color="info" subValue="No major deviations" />
                <StatCard
                    label="Current Power"
                    value={powerPct}
                    icon={Zap}
                    color={power ? powerColor(power.currentPower) : 'info'}
                    subValue={power ? `Required n = ${power.requiredSampleSize}` : 'Run power analysis'}
                />
            </div>

            {/* ROW 2 — 60/40 */}
            <div className="stat-row2">
                {/* Left: Analysis Datasets */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Database size={18} /> Analysis Datasets</h3>
                        <Link to="/statistics/datasets" className="sm-link" style={{ textDecoration: 'none' }}>Generate Dataset →</Link>
                    </div>
                    <DatasetsTable rows={data.analysisDatasets} />
                </div>

                {/* Right: Active Data Locks */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            {data.activeLocks?.length > 0
                                ? <><CheckCircle size={16} color="#10B981" /> Data available for analysis</>
                                : <><Activity size={16} /> Active Data Locks</>}
                        </h3>
                        <Link to="/data-management/lock" className="sm-link" style={{ textDecoration: 'none' }}>Manage →</Link>
                    </div>
                    <div className="stat-locks-list">
                        {data.activeLocks?.length === 0 ? (
                            <div className="sm-empty" style={{ color: '#9CA3AF' }}>No locked datasets</div>
                        ) : data.activeLocks.map((l: any) => (
                            <div key={l.lock_id} className="stat-lock-item">
                                <div className="stat-lock-top">
                                    <span className="stat-lock-trial">{l.trial_title}</span>
                                    <span className={`stat-badge stat-badge-${l.lock_type === 'Final' ? 'green' : 'blue'}`}>{l.lock_type}</span>
                                </div>
                                <div className="stat-lock-bottom">
                                    <span>Locked {daysAgo(l.lock_date)}</span>
                                    <span className="stat-mono">{String(l.snapshot_hash).substring(0, 12)}…</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ROW 3 — Full width: Enrollment */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Users size={18} /> Trial Enrollment — Power Context</h3>
                </div>
                <div className="stat-enroll-list">
                    {data.enrollmentByTrial?.map((t: any) => <EnrollmentBar key={t.trial_id} t={t} />)}
                </div>
            </div>

            {/* ROW 4 — 50/50 */}
            <div className="stat-row4">
                {/* Left: Recent Survival Analyses */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Activity size={18} /> Recent Survival Analyses</h3>
                        <Link to="/statistics/survival" className="sm-link" style={{ textDecoration: 'none' }}>Run New →</Link>
                    </div>
                    <SurvivalList rows={data.recentSurvivalAnalyses} />
                </div>

                {/* Right: Randomization Balance */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><BarChart2 size={18} /> Randomization Balance</h3>
                        <Link to="/statistics/balance" className="sm-link" style={{ textDecoration: 'none' }}>Full Report →</Link>
                    </div>
                    <BalanceTable rows={data.randomizationBalance} />
                </div>
            </div>
        </div>
    );
};
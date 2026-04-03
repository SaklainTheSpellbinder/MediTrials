import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    AlertTriangle, Clock, TrendingUp, TrendingDown, Minus,
    ShieldAlert, Activity, FileWarning, ArrowRight, CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/dashboard/StatCard';
import '../Dashboard.css';
import './SafetyMonitorDashboard.css';
import { safetyManagerAPI } from '../../services/api';

export interface OverdueSAE {
    sae_report_number: string;
    trial_patient_id: string;
    site_name: string;
    ae_term: string;
    severity_grade: number;
    report_deadline_date: string;
    days_overdue: number;
    hours_until_deadline: string | number;
}

export interface CriticalAlert {
    alert_id: number;
    trial_patient_id: string;
    site_name: string;
    alert_code: string;
    alert_message: string;
    alert_severity: string;
    created_at: string;
    minutes_open: number;
}

export interface GradeByTrial {
    trial_id: number;
    trial_title: string;
    grade1: string | number;
    grade2: string | number;
    grade3: string | number;
    grade4: string | number;
    grade5: string | number;
}

export interface SafetySignal {
    ae_term: string;
    total_count: number;
    treatment_count: number;
    control_count: number;
    prr: string | number;
    signal_strength: string;
}

export interface SAETimeline {
    sae_id: number;
    sae_report_number: string;
    trial_patient_id: string;
    ae_term: string;
    report_deadline_date: string;
    sae_status: string;
    hours_until_deadline: string | number;
}

export interface SafetyDashboardData {
    criticalAlerts: number;
    pendingSaeCount: number;
    overdueSaeCount: number;
    totalAeThisMonth: number;
    totalAeLastMonth: number;
    aeTrend: 'up' | 'down' | 'flat';
    trialSafetyOverview: any[];
    overdueSaes: OverdueSAE[];
    criticalAlertsFeed: CriticalAlert[];
    aeByGradeByTrial: GradeByTrial[];
    topSignals: SafetySignal[];
    pendingSaeTimeline: SAETimeline[];
    trialKpis: any[];
    systemEvents: any[];
}

// ── Severity badge
const SeverityBadge: React.FC<{ level: string }> = ({ level }) => {
    const map: Record<string, string> = {
        CRITICAL: 'badge-critical', SEVERE: 'badge-severe',
        HIGH: 'badge-severe', MEDIUM: 'badge-medium', LOW: 'badge-low',
    };
    return <span className={`sm-badge ${map[level] ?? 'badge-low'}`}>{level}</span>;
};

// ── Signal strength badge ─────────────────────────────────────────────────────
const SignalBadge: React.FC<{ strength: string }> = ({ strength }) => {
    const cls = strength === 'HIGH' ? 'badge-critical' : strength === 'MEDIUM' ? 'badge-medium' : 'badge-low';
    return <span className={`sm-badge ${cls}`}>{strength}</span>;
};

// ── Timeline bar colour ───────────────────────────────────────────────────────
const timelineColor = (hours: number) => {
    if (hours < 0) return '#DC2626';   // overdue
    if (hours < 12) return '#DC2626';  // red
    if (hours < 48) return '#F59E0B';  // amber
    return '#10B981';                  // green
};

// ── Acknowledge inline form ───────────────────────────────────────────────────
const AcknowledgeForm: React.FC<{ alertId: number; onDone: () => void }> = ({ alertId, onDone }) => {
    const [reason, setReason] = useState('');
    const qc = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: (r: string) => safetyManagerAPI.acknowledgeAlert(alertId, { reason: r }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dashboard', 'safety-monitor'] });
            onDone();
        },
    });

    return (
        <div className="ack-form">
            <textarea
                className="ack-textarea"
                placeholder="Acknowledgement reason…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
            />
            <button
                className="ack-btn"
                disabled={isPending || !reason.trim()}
                onClick={() => mutate(reason)}
            >
                {isPending ? 'Saving…' : 'Confirm'}
            </button>
        </div>
    );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export const SafetyMonitorDashboard: React.FC = () => {
    const { user } = useAuth();
    const [ackOpen, setAckOpen] = useState<number | null>(null);

    const { data, isLoading, isError } = useQuery<SafetyDashboardData>({
        queryKey: ['dashboard', 'safety-monitor'],
        queryFn: () => safetyManagerAPI.getSafetyMonitorDashboard(),
        refetchInterval: 30000,
    });

    if (isLoading) {
        return (
            <div className="dashboard-container">
                <div className="sm-loading">
                    <Activity size={32} className="sm-spin" />
                    <p>Loading safety data…</p>
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="dashboard-container">
                <div className="sm-error">
                    <ShieldAlert size={32} />
                    <p>Failed to load dashboard. Check backend connection.</p>
                </div>
            </div>
        );
    }

    // ── Trend calculation ────────────────────────────────────────────────────
    const { totalAeThisMonth: thisM, totalAeLastMonth: lastM, aeTrend } = data;
    const pctDiff = lastM > 0 ? Math.abs(Math.round(((thisM - lastM) / lastM) * 100)) : 0;
    const TrendIcon = aeTrend === 'up' ? TrendingUp : aeTrend === 'down' ? TrendingDown : Minus;

    // ── Grade chart data ─────────────────────────────────────────────────────
    const gradeData = (data.aeByGradeByTrial ?? []).map((r) => ({
        name: r.trial_title?.length > 20 ? r.trial_title.slice(0, 20) + '…' : r.trial_title ?? '—',
        G1: typeof r.grade1 === 'string' ? parseInt(r.grade1) : (r.grade1 || 0),
        G2: typeof r.grade2 === 'string' ? parseInt(r.grade2) : (r.grade2 || 0),
        G3: typeof r.grade3 === 'string' ? parseInt(r.grade3) : (r.grade3 || 0),
        G4: typeof r.grade4 === 'string' ? parseInt(r.grade4) : (r.grade4 || 0),
        G5: typeof r.grade5 === 'string' ? parseInt(r.grade5) : (r.grade5 || 0),
    }));

    // ── Timeline max hours (for proportional widths) ─────────────────────────
    const maxHours = Math.max(
        72,
        ...(data.pendingSaeTimeline ?? []).map((s) => Math.abs(typeof s.hours_until_deadline === 'string' ? parseFloat(s.hours_until_deadline) : (s.hours_until_deadline || 0)))
    );

    return (
        <div className="dashboard-container">
            {/* ── Header ── */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Safety Monitor Dashboard</h1>
                    <p className="text-gray-500 text-sm">
                        Welcome, {user?.full_name} · All trials · Auto-refreshes every 30s
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link to="/safety/reports" className="btn-secondary" style={{ textDecoration: 'none' }}>Generate Report</Link>
                    <Link to="/safety/alerts" className="btn-primary" style={{ textDecoration: 'none' }}>View All Alerts</Link>
                </div>
            </div>

            {/* ── ROW 1: 4 Stat Cards ── */}
            <div className="stats-grid">
                <StatCard
                    label="Critical Alerts"
                    value={data.criticalAlerts}
                    icon={ShieldAlert}
                    color="danger"
                    subValue="CRITICAL + SEVERE, all trials"
                />
                <StatCard
                    label="Pending SAE Reports"
                    value={data.pendingSaeCount}
                    icon={Clock}
                    color="warning"
                    subValue="Due within 72 hours"
                />
                <StatCard
                    label="Overdue SAE Reports"
                    value={data.overdueSaeCount}
                    icon={FileWarning}
                    color="danger"
                    subValue="Past deadline, not submitted"
                />
                <StatCard
                    label="AEs This Month"
                    value={data.totalAeThisMonth}
                    icon={TrendIcon}
                    color="info"
                    subValue={`${aeTrend === 'up' ? '↑' : aeTrend === 'down' ? '↓' : '→'} ${pctDiff > 0 ? pctDiff + '% vs last month' : 'same as last month'}`}
                />
            </div>

            {/* ── ROW 2: Overdue SAEs (60%) + Alert Feed (40%) ── */}
            <div className="sm-row2">
                {/* Left: Overdue SAEs table */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FileWarning size={18} />
                            Overdue &amp; At-Risk SAEs
                        </h3>
                        <Link to="/safety/sae" className="sm-link" style={{ textDecoration: 'none' }}>
                            View All SAEs <ArrowRight size={14} />
                        </Link>
                    </div>
                    {data.overdueSaes?.length === 0 ? (
                        <div className="sm-empty">
                            <CheckCircle size={20} className="text-success" />
                            All reports on track ✓
                        </div>
                    ) : (
                        <div className="sm-table-wrap">
                            <table className="sm-table">
                                <thead>
                                    <tr>
                                        <th>Report #</th>
                                        <th>Patient</th>
                                        <th>Site</th>
                                        <th>AE Term</th>
                                        <th>Grade</th>
                                        <th>Deadline</th>
                                        <th>Overdue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.overdueSaes.map((s) => {
                                        const isOverdue = (s.days_overdue ?? 0) > 0;
                                        const hoursUntil = typeof s.hours_until_deadline === 'string' ? parseFloat(s.hours_until_deadline) : s.hours_until_deadline;
                                        const isUrgent = !isOverdue && (hoursUntil < 48);
                                        const rowCls = isOverdue ? 'row-red' : isUrgent ? 'row-amber' : '';
                                        return (
                                            <tr key={s.sae_report_number} className={rowCls}>
                                                <td className="font-mono text-xs">{s.sae_report_number}</td>
                                                <td>{s.trial_patient_id}</td>
                                                <td className="text-xs">{s.site_name}</td>
                                                <td className="font-medium">{s.ae_term}</td>
                                                <td>
                                                    <span className={`grade-badge grade-${s.severity_grade}`}>
                                                        G{s.severity_grade}
                                                    </span>
                                                </td>
                                                <td className="text-xs">{s.report_deadline_date?.split('T')[0]}</td>
                                                <td className={isOverdue ? 'text-danger font-bold' : 'text-amber'}>
                                                    {isOverdue ? `${s.days_overdue}d` : `${Math.round(hoursUntil)}h`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right: Critical Alerts feed */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <AlertTriangle size={18} />
                            Active Critical Alerts
                        </h3>
                        <Link to="/safety/alerts" className="sm-link" style={{ textDecoration: 'none' }}>
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="sm-alerts-feed">
                        {data.criticalAlertsFeed?.length === 0 ? (
                            <div className="sm-empty">
                                <CheckCircle size={20} className="text-success" />
                                No critical alerts active
                            </div>
                        ) : (
                            data.criticalAlertsFeed.map((a) => (
                                <div key={a.alert_id} className="sm-alert-item">
                                    <div className="sm-alert-top">
                                        <SeverityBadge level={a.alert_severity} />
                                        <span className="sm-patient">{a.trial_patient_id}</span>
                                        <span className="sm-site text-xs">{a.site_name}</span>
                                        <span className="sm-time">{a.minutes_open}m ago</span>
                                    </div>
                                    <p className="sm-alert-msg">{a.alert_message}</p>
                                    {ackOpen === a.alert_id ? (
                                        <AcknowledgeForm
                                            alertId={a.alert_id}
                                            onDone={() => setAckOpen(null)}
                                        />
                                    ) : (
                                        <button
                                            className="btn-xs sm-ack-btn"
                                            onClick={() => setAckOpen(a.alert_id)}
                                        >
                                            Acknowledge
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ── ROW 3: AE Grade Chart (55%) + Signal Panel (45%) ── */}
            <div className="sm-row3">
                {/* Left: AE Severity by Trial */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Activity size={18} />
                            AE Severity by Trial <span className="sm-subtitle">Last 30 days</span>
                        </h3>
                    </div>
                    <div className="sm-chart-wrap">
                        {gradeData.length === 0 ? (
                            <div className="sm-empty">No AE data in the last 30 days</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={gradeData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="G1" name="Grade 1" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="G2" name="Grade 2" fill="#0D9488" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="G3" name="Grade 3" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="G4" name="Grade 4" fill="#F97316" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="G5" name="Grade 5" fill="#DC2626" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Right: Safety Signal Detection */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <ShieldAlert size={18} />
                            Safety Signal Detection
                            <span className="sm-subtitle">Top signals · PRR</span>
                        </h3>
                        <Link to="/safety/signals" className="sm-link" style={{ textDecoration: 'none' }}>
                            Full Analysis <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="sm-signal-list">
                        {data.topSignals?.length === 0 ? (
                            <div className="sm-empty">No safety signals detected</div>
                        ) : (
                            data.topSignals.map((sig, i) => (
                                <div key={i} className="sm-signal-row">
                                    <div className="sm-signal-left">
                                        <span className="sm-signal-term">{sig.ae_term}</span>
                                        <span className="sm-signal-count text-xs text-gray-400">
                                            n={sig.total_count}
                                        </span>
                                    </div>
                                    <div className="sm-signal-right">
                                        <span className="sm-prr">PRR {parseFloat(String(sig.prr ?? 0)).toFixed(2)}</span>
                                        <SignalBadge strength={sig.signal_strength} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ── ROW 4: SAE Reporting Timeline ── */}
            <div className="card sm-timeline-card">
                <div className="card-header">
                    <h3 className="card-title">
                        <Clock size={18} />
                        SAE Reporting Timeline
                        <span className="sm-subtitle">Pending reports</span>
                    </h3>
                    <div className="sm-timeline-legend">
                        <span className="sm-legend-dot" style={{ background: '#10B981' }} /> &gt;48h
                        <span className="sm-legend-dot" style={{ background: '#F59E0B', marginLeft: 12 }} /> 12–48h
                        <span className="sm-legend-dot" style={{ background: '#DC2626', marginLeft: 12 }} /> &lt;12h / Overdue
                    </div>
                </div>
                <div className="sm-timeline-body">
                    {!data.pendingSaeTimeline?.length ? (
                        <div className="sm-empty">
                            <CheckCircle size={20} className="text-success" />
                            No pending SAEs
                        </div>
                    ) : (
                        data.pendingSaeTimeline.map((s) => {
                            const hours = typeof s.hours_until_deadline === 'string' ? parseFloat(s.hours_until_deadline) : (s.hours_until_deadline || 0);
                            const color = timelineColor(hours);
                            const widthPct = Math.min(100, Math.max(4, (Math.abs(hours) / maxHours) * 100));
                            const label = hours < 0
                                ? `OVERDUE ${Math.abs(Math.round(hours))}h`
                                : `${Math.round(hours)}h remaining`;
                            return (
                                <div key={s.sae_id} className="sm-timeline-row">
                                    <div className="sm-timeline-meta">
                                        <span className="sm-timeline-id">{s.sae_report_number}</span>
                                        <span className="sm-timeline-patient">{s.trial_patient_id}</span>
                                        <span className="sm-timeline-ae">{s.ae_term}</span>
                                    </div>
                                    <div className="sm-timeline-bar-wrap">
                                        <div
                                            className="sm-timeline-bar"
                                            style={{ width: `${widthPct}%`, background: color }}
                                        />
                                        <span className="sm-timeline-label" style={{ color }}>
                                            {label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
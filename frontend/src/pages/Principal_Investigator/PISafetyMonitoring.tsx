import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    AlertTriangle, Clock, TrendingUp, TrendingDown, Minus,
    ShieldAlert, Activity, FileWarning, CheckCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/dashboard/StatCard';
import { SeverityBadge } from '../../components/safety/SeverityBadge';
import { AEGradeBadge } from '../../components/safety/AEGradeBadge';
import '../Dashboard.css';
import './PISafetyMonitoring.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

const AcknowledgeForm: React.FC<{ alertId: number; onDone: () => void }> = ({ alertId, onDone }) => {
    const [reason, setReason] = useState('');
    const qc = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: (r: string) => safetyApi.put(`/api/pi-safety/alerts/${alertId}/acknowledge`, { reason: r }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dashboard', 'pi-safety'] });
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

export const PISafetyMonitoring: React.FC = () => {
    const { user } = useAuth();
    const [ackOpen, setAckOpen] = useState<number | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard', 'pi-safety'],
        queryFn: () => safetyApi.get('/api/pi-safety/dashboard').then(r => r.data),
        refetchInterval: 30000,
    });

    if (isLoading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--gray-500)' }}>
                    <Activity size={32} className="sm-spin" />
                    <p>Loading site safety data…</p>
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--color-danger)' }}>
                    <ShieldAlert size={32} />
                    <p>Failed to load dashboard. Check backend connection.</p>
                </div>
            </div>
        );
    }

    const { kpis, alerts, aes, saes } = data;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Site Safety Monitoring</h1>
                    <p className="text-gray-500 text-sm">
                        Welcome, {user?.full_name} · Site specific safety view
                    </p>
                </div>
            </div>

            {/* ── ROW 1: KPIs ── */}
            <div className="stats-grid">
                <StatCard
                    label="Active Alerts"
                    value={kpis.active_alerts || 0}
                    icon={ShieldAlert}
                    color="danger"
                    subValue="CRITICAL + SEVERE for your site"
                />
                <StatCard
                    label="AEs This Month"
                    value={kpis.ae_this_month || 0}
                    icon={Activity}
                    color="info"
                    subValue="Adverse events logged"
                />
                <StatCard
                    label="Open SAE Reports"
                    value={kpis.open_saes || 0}
                    icon={FileWarning}
                    color="warning"
                    subValue="Pending investigation/submission"
                />
                <StatCard
                    label="Overdue SAEs"
                    value={kpis.overdue_saes || 0}
                    icon={AlertTriangle}
                    color="danger"
                    subValue="Past deadline, not submitted"
                />
            </div>

            <div className="pi-safety-grid">
                {/* ── ROW 2 LEFT: Overdue/Pending SAEs ── */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <FileWarning size={18} />
                            Site SAEs Needing Attention
                        </h3>
                    </div>
                    {saes?.length === 0 ? (
                        <div className="sm-empty">
                            <CheckCircle size={20} className="text-success" />
                            All site SAE reports on track ✓
                        </div>
                    ) : (
                        <div className="sm-table-wrap">
                            <table className="sm-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>AE Term</th>
                                        <th>Grade</th>
                                        <th>Deadline</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saes.map((s: any) => {
                                        const isOverdue = (s.days_overdue ?? 0) > 0;
                                        const isUrgent = !isOverdue && (parseFloat(s.hours_until_deadline) < 48);
                                        const rowCls = isOverdue ? 'row-red' : isUrgent ? 'row-amber' : '';
                                        return (
                                            <tr key={s.sae_report_number} className={rowCls}>
                                                <td>{s.trial_patient_id}</td>
                                                <td className="font-medium">{s.ae_term}</td>
                                                <td>
                                                    <AEGradeBadge grade={s.severity_grade} />
                                                </td>
                                                <td className="text-xs">{s.report_deadline_date?.split('T')[0]}</td>
                                                <td className={isOverdue ? 'text-danger font-bold text-xs' : 'text-amber font-bold text-xs'}>
                                                    {isOverdue ? `Overdue ${s.days_overdue}d` : `Due in ${Math.round(parseFloat(s.hours_until_deadline))}h`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── ROW 2 RIGHT: Critical Alerts ── */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <AlertTriangle size={18} />
                            Active Critical Alerts
                        </h3>
                    </div>
                    <div className="sm-alerts-feed">
                        {alerts?.length === 0 ? (
                            <div className="sm-empty">
                                <CheckCircle size={20} className="text-success" />
                                No critical alerts active for your site
                            </div>
                        ) : (
                            alerts.map((a: any) => (
                                <div key={a.alert_id} className="sm-alert-item">
                                    <div className="sm-alert-top">
                                        <SeverityBadge level={a.alert_severity} />
                                        <span className="sm-patient">{a.trial_patient_id}</span>
                                        <span className="sm-time">{a.minutes_open}m ago</span>
                                    </div>
                                    <p className="sm-alert-msg">{a.alert_message}</p>
                                    
                                    {/* Action button inside the feed */}
                                    {ackOpen === a.alert_id ? (
                                        <AcknowledgeForm
                                            alertId={a.alert_id}
                                            onDone={() => setAckOpen(null)}
                                        />
                                    ) : (
                                        <button
                                            className="sm-ack-btn"
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

            {/* ── ROW 3: Recent AEs ── */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <Activity size={18} />
                        Recent Adverse Events
                    </h3>
                </div>
                {aes?.length === 0 ? (
                    <div className="sm-empty">
                        <CheckCircle size={20} className="text-success" />
                        No recent adverse events recorded
                    </div>
                ) : (
                    <div className="sm-table-wrap">
                        <table className="sm-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>AE Term</th>
                                    <th>Onset Date</th>
                                    <th>Grade</th>
                                    <th>Resolution Status</th>
                                    <th>Causality</th>
                                    <th>SAE Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aes.map((ae: any) => (
                                    <tr key={ae.ae_id}>
                                        <td className="font-medium">{ae.trial_patient_id}</td>
                                        <td>{ae.ae_term}</td>
                                        <td className="text-xs">{ae.ae_start_date?.split('T')[0]}</td>
                                        <td><AEGradeBadge grade={ae.severity_grade} /></td>
                                        <td><span className="text-xs px-2 py-1 bg-gray-100 rounded-full">{ae.status || 'Active'}</span></td>
                                        <td className="text-xs">{ae.causality_relationship ?? '—'}</td>
                                        <td className="text-xs">
                                            {ae.sae_report_number ? (
                                                <span className="text-danger font-bold">YES</span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
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

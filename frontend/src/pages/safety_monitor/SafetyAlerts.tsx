import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { SeverityBadge } from '../../components/safety/SeverityBadge';
import { AlertTriangle, Shield, Info, CheckCircle, AlertCircle, X, Activity } from 'lucide-react';
import '../Dashboard.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

const KpiCard: React.FC<{ label: string; value: number; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        <div>
            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>{value}</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 500 }}>{label}</p>
        </div>
    </div>
);

const AlertDetailModal: React.FC<{ alertId: number; onClose: () => void }> = ({ alertId, onClose }) => {
    const qc = useQueryClient();
    const { user } = useAuth();
    const [ackReason, setAckReason] = useState('');
    const [escLevel, setEscLevel] = useState(5);
    const [escReason, setEscReason] = useState('');
    const [dismissReason, setDismissReason] = useState('');
    const [activeSection, setActiveSection] = useState<'ack' | 'esc' | 'dismiss'>('ack');
    const [msg, setMsg] = useState('');

    const { data: alerts } = useQuery({
        queryKey: ['alerts-list'],
        queryFn: () => safetyApi.get('/api/safety/alerts').then(r => r.data),
    });
    const alert = (alerts?.alerts ?? []).find((a: any) => a.alert_id === alertId);

    const makeAction = (url: string, body: any) => useMutation({
        mutationFn: () => safetyApi.put(url, body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts-list'] }); setMsg('Done ✓'); setTimeout(onClose, 1200); },
        onError: (e: any) => setMsg(e.message),
    });

    const ackMut = useMutation({
        mutationFn: () => safetyApi.put(`/api/safety/alerts/${alertId}/acknowledge`, { reason: ackReason }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts-list'] }); setMsg('Acknowledged ✓'); setTimeout(onClose, 1200); },
        onError: (e: any) => setMsg(e.message),
    });
    const escMut = useMutation({
        mutationFn: () => safetyApi.put(`/api/safety/alerts/${alertId}/escalate`, { escalation_level: escLevel, reason: escReason }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts-list'] }); setMsg('Escalated ✓'); setTimeout(onClose, 1200); },
        onError: (e: any) => setMsg(e.message),
    });
    const dismissMut = useMutation({
        mutationFn: () => safetyApi.put(`/api/safety/alerts/${alertId}/dismiss`, { reason: dismissReason }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts-list'] }); setMsg('Dismissed ✓'); setTimeout(onClose, 1200); },
        onError: (e: any) => setMsg(e.message),
    });

    if (!alert) return null;

    const labRatio = alert.reference_range_high
        ? ((alert.test_value - alert.reference_range_high) / alert.reference_range_high * 100).toFixed(1)
        : null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 12, width: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SeverityBadge level={alert.alert_severity} size="md" />
                        <div>
                            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{alert.alert_code}</h3>
                            <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.78rem' }}>{alert.trial_patient_id} · {alert.site_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '1rem', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                        {alert.alert_message}
                    </div>

                    {/* Lab value range bar if lab result alert */}
                    {alert.source_type === 'LAB_RESULT' && alert.test_value != null && (
                        <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '1rem' }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.8rem', color: '#DC2626' }}>
                                {alert.test_name}: {alert.test_value} (Normal: {alert.reference_range_low}–{alert.reference_range_high})
                            </p>
                            {labRatio !== null && parseFloat(labRatio) > 0 && (
                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#DC2626' }}>
                                    ⬆ {labRatio}% above upper normal limit
                                </p>
                            )}
                            <div style={{ marginTop: 10, height: 8, background: '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', background: '#DC2626', borderRadius: 99,
                                    width: `${Math.min(100, Math.max(10, (alert.test_value / (alert.reference_range_high * 1.5)) * 100))}%`
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Action tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 8 }}>
                        {(['ack', 'esc', 'dismiss'] as const).map(s => (
                            <button key={s} onClick={() => setActiveSection(s)} style={{
                                flex: 1, padding: '8px', border: 'none', background: 'none', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.8rem',
                                borderBottom: activeSection === s ? '2px solid #2563EB' : '2px solid transparent',
                                color: activeSection === s ? '#2563EB' : 'var(--gray-500)',
                            }}>{{ ack: 'Acknowledge', esc: 'Escalate', dismiss: 'Dismiss' }[s]}</button>
                        ))}
                    </div>

                    {activeSection === 'ack' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label className="form-label">Acknowledgement Reason <span style={{ color: '#DC2626' }}>*</span></label>
                            <textarea className="ack-textarea" rows={3} value={ackReason} onChange={e => setAckReason(e.target.value)} placeholder="Provide reason for acknowledgement…" />
                            <button className="btn-primary" disabled={!ackReason || ackMut.isPending} onClick={() => ackMut.mutate()}>
                                {ackMut.isPending ? 'Acknowledging…' : 'Acknowledge Alert'}
                            </button>
                        </div>
                    )}

                    {activeSection === 'esc' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                                <label className="form-label">Escalation Level</label>
                                <select className="form-select" value={escLevel} onChange={e => setEscLevel(parseInt(e.target.value))}>
                                    {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>Level {l}</option>)}
                                </select>
                            </div>
                            <label className="form-label">Escalation Reason <span style={{ color: '#DC2626' }}>*</span></label>
                            <textarea className="ack-textarea" rows={3} value={escReason} onChange={e => setEscReason(e.target.value)} placeholder="Why is this being escalated?" />
                            <button style={{ background: '#F59E0B', color: 'white', padding: '8px 16px', borderRadius: 6, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                disabled={!escReason || escMut.isPending} onClick={() => escMut.mutate()}>
                                {escMut.isPending ? 'Escalating…' : 'Escalate Alert'}
                            </button>
                        </div>
                    )}

                    {activeSection === 'dismiss' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label className="form-label">Dismiss Reason <span style={{ color: '#DC2626' }}>*</span></label>
                            <textarea className="ack-textarea" rows={3} value={dismissReason} onChange={e => setDismissReason(e.target.value)} placeholder="Why is this alert being dismissed?" />
                            <button style={{ background: '#DC2626', color: 'white', padding: '8px 16px', borderRadius: 6, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                disabled={!dismissReason || dismissMut.isPending} onClick={() => dismissMut.mutate()}>
                                {dismissMut.isPending ? 'Dismissing…' : 'Dismiss Alert'}
                            </button>
                        </div>
                    )}

                    {msg && <p style={{ color: msg.includes('✓') ? '#10B981' : '#DC2626', fontWeight: 600 }}>{msg}</p>}
                </div>
            </div>
        </div>
    );
};

function hrsLabel(hrs: number) {
    if (hrs < 1) return `${Math.round(hrs * 60)}m`;
    if (hrs < 24) return `${hrs.toFixed(1)}h`;
    return `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h`;
}

export const SafetyAlerts: React.FC = () => {
    const [severity, setSeverity] = useState('');
    const [alertStatus, setAlertStatus] = useState('ACTIVE');
    const [siteId, setSiteId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
    const [selected, setSelected] = useState<number[]>([]);
    const qc = useQueryClient();

    const { data } = useQuery({
        queryKey: ['alerts-list', severity, alertStatus, siteId, dateFrom, dateTo],
        queryFn: () => safetyApi.get('/api/safety/alerts', {
            params: {
                severity: severity || undefined, status: alertStatus || undefined,
                site_id: siteId || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined
            }
        }).then(r => r.data),
        refetchInterval: 30000,
    });

    const { data: sites } = useQuery({ queryKey: ['safety-sites'], queryFn: () => safetyApi.get('/api/safety/sites').then(r => r.data) });
    const alerts = data?.alerts ?? [];
    const kpis = data?.kpis ?? {};

    const bulkAckMut = useMutation({
        mutationFn: () => Promise.all(selected.map(id => safetyApi.put(`/api/safety/alerts/${id}/acknowledge`, { reason: 'Bulk acknowledge' }))),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts-list'] }); setSelected([]); },
    });

    const toggleSelect = (id: number) => setSelected(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Safety Alerts Management</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Monitor and action all clinical safety alerts</p>
                </div>
                {selected.length > 0 && (
                    <button className="btn-secondary" onClick={() => bulkAckMut.mutate()}>
                        Bulk Acknowledge ({selected.length})
                    </button>
                )}
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: '1.5rem' }}>
                <KpiCard label="Total Active" value={parseInt(kpis.total_active) || 0} color="#6B7280" icon={<Activity size={20} />} />
                <KpiCard label="CRITICAL" value={parseInt(kpis.critical) || 0} color="#DC2626" icon={<AlertCircle size={20} />} />
                <KpiCard label="SEVERE" value={parseInt(kpis.severe) || 0} color="#EA580C" icon={<AlertTriangle size={20} />} />
                <KpiCard label="WARNING" value={parseInt(kpis.warning) || 0} color="#F59E0B" icon={<AlertTriangle size={20} />} />
                <KpiCard label="INFO" value={parseInt(kpis.info) || 0} color="#3B82F6" icon={<Info size={20} />} />
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label className="form-label">Severity</label>
                        <select className="form-select" value={severity} onChange={e => setSeverity(e.target.value)}>
                            <option value="">All Severities</option>
                            {['CRITICAL', 'SEVERE', 'WARNING', 'INFO'].map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Status</label>
                        <select className="form-select" value={alertStatus} onChange={e => setAlertStatus(e.target.value)}>
                            <option value="">All</option>
                            {['ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'DISMISSED'].map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Site</label>
                        <select className="form-select" value={siteId} onChange={e => setSiteId(e.target.value)}>
                            <option value="">All Sites</option>
                            {(sites ?? []).map((s: any) => <option key={s.site_id} value={s.site_id}>{s.institution_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">From</label>
                        <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">To</label>
                        <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {alerts.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                        <Shield size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <p style={{ fontWeight: 600 }}>No active alerts — system is safe</p>
                        <p style={{ fontSize: '0.875rem' }}>No alerts match the current filters.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="sm-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}></th>
                                    <th>Alert ID</th><th>Patient</th><th>Site</th><th>Code</th>
                                    <th>Message</th><th>Severity</th><th>Status</th>
                                    <th>Source</th><th>Created</th><th>Time Open</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((a: any) => (
                                    <tr key={a.alert_id} onClick={() => setSelectedAlertId(a.alert_id)} style={{ cursor: 'pointer' }}>
                                        <td onClick={e => { e.stopPropagation(); toggleSelect(a.alert_id); }}>
                                            <input type="checkbox" checked={selected.includes(a.alert_id)} readOnly style={{ width: 14, height: 14 }} />
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>#{a.alert_id}</td>
                                        <td style={{ fontWeight: 600 }}>{a.trial_patient_id}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{a.site_name}</td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{a.alert_code}</td>
                                        <td style={{ fontSize: '0.8rem', maxWidth: 240 }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 220 }}>
                                                {a.alert_message}
                                            </span>
                                        </td>
                                        <td><SeverityBadge level={a.alert_severity} /></td>
                                        <td><span style={{
                                            background: a.alert_status === 'ACTIVE' ? '#FEE2E2' : '#F3F4F6',
                                            color: a.alert_status === 'ACTIVE' ? '#991B1B' : '#6B7280',
                                            padding: '1px 7px', borderRadius: 9999, fontSize: '0.7rem', fontWeight: 600,
                                        }}>{a.alert_status}</span></td>
                                        <td style={{ fontSize: '0.75rem' }}>{a.source_type ?? '—'}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{a.created_at?.split('T')[0]}</td>
                                        <td style={{ fontWeight: 600, fontSize: '0.8rem', color: parseFloat(a.hours_open) > 24 ? '#DC2626' : 'inherit' }}>
                                            {hrsLabel(parseFloat(a.hours_open) || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedAlertId && <AlertDetailModal alertId={selectedAlertId} onClose={() => setSelectedAlertId(null)} />}
        </div>
    );
};

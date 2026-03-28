import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Shield, TrendingUp, ChevronRight, X, Activity } from 'lucide-react';
import { SeverityBadge } from '../../components/safety/SeverityBadge';
import { AEGradeBadge } from '../../components/safety/AEGradeBadge';
import '../Dashboard.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const size = payload.signal_strength === 'HIGH' ? 18 : payload.signal_strength === 'MEDIUM' ? 12 : 7;
    const color = payload.signal_strength === 'HIGH' ? '#DC2626' : payload.signal_strength === 'MEDIUM' ? '#F59E0B' : '#10B981';
    return <circle cx={cx} cy={cy} r={size} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={1.5} />;
};

const SignalTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.8rem' }}>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{d.ae_term}</p>
            <p style={{ margin: '0 0 2px', color: 'var(--gray-600)' }}>Total: {d.total_count}</p>
            <p style={{ margin: '0 0 2px', color: 'var(--gray-600)' }}>PRR: {parseFloat(d.prr || 0).toFixed(2)}</p>
            <p style={{ margin: 0 }}><SeverityBadge level={d.signal_strength} /></p>
        </div>
    );
};

const DrilldownPanel: React.FC<{ aeTerm: string; trialId: string; onClose: () => void }> = ({ aeTerm, trialId, onClose }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['signal-drilldown', aeTerm, trialId],
        queryFn: () => safetyApi.get('/api/safety/signals/drilldown', { params: { ae_term: aeTerm, trial_id: trialId || undefined } }).then(r => r.data),
    });

    const binDays = (aes: any[]) => {
        const bins: Record<string, number> = { '0-7': 0, '8-14': 0, '15-30': 0, '31-90': 0, '90+': 0 };
        aes.forEach((ae: any) => {
            const d = parseInt(ae.days_from_enrollment) || 0;
            if (d <= 7) bins['0-7']++;
            else if (d <= 14) bins['8-14']++;
            else if (d <= 30) bins['15-30']++;
            else if (d <= 90) bins['31-90']++;
            else bins['90+']++;
        });
        return Object.entries(bins).map(([name, count]) => ({ name, count }));
    };

    return (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 520, height: '100vh', background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 1000, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--gray-200)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 700 }}>{aeTerm}</h3>
                    <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.8rem' }}>Signal Investigation · {data?.aes?.length ?? 0} cases</p>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {isLoading && <p style={{ color: 'var(--gray-400)' }}>Loading…</p>}

                {/* Time-to-onset histogram */}
                {data?.aes?.length > 0 && (
                    <div>
                        <h4 style={sh}>Time-to-Onset Distribution</h4>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={binDays(data.aes)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#DC2626" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Individual AE cases */}
                {data?.aes?.length > 0 && (
                    <div>
                        <h4 style={sh}>Matching Cases</h4>
                        <table className="sm-table">
                            <thead>
                                <tr><th>Patient</th><th>Site</th><th>Onset</th><th>Grade</th><th>Causality</th></tr>
                            </thead>
                            <tbody>
                                {data.aes.slice(0, 20).map((ae: any) => (
                                    <tr key={ae.ae_id}>
                                        <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{ae.trial_patient_id}</td>
                                        <td style={{ fontSize: '0.75rem' }}>{ae.site_name}</td>
                                        <td style={{ fontSize: '0.75rem' }}>{ae.ae_start_date?.split('T')[0]}</td>
                                        <td><AEGradeBadge grade={ae.severity_grade} /></td>
                                        <td style={{ fontSize: '0.75rem' }}>{ae.causality_relationship ?? '—'}</td>
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

const sh: React.CSSProperties = { margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export const SafetySignals: React.FC = () => {
    const [trialId, setTrialId] = useState('');
    const [signals, setSignals] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [drilldownTerm, setDrilldownTerm] = useState<string | null>(null);

    const { data: trials } = useQuery({ queryKey: ['safety-trials'], queryFn: () => safetyApi.get('/api/safety/trials').then(r => r.data) });

    const runDetection = async () => {
        if (!trialId) return;
        setLoading(true);
        try {
            const r = await safetyApi.get('/api/safety/signals', { params: { trial_id: trialId } });
            setSignals(r.data ?? []);
        } finally {
            setLoading(false);
        }
    };

    const bubbleData = signals.map((s: any) => ({
        ae_term: s.ae_term,
        x: parseInt(s.total_count) || 0,
        y: parseFloat(s.prr) || 0,
        z: s.signal_strength === 'HIGH' ? 600 : s.signal_strength === 'MEDIUM' ? 300 : 100,
        signal_strength: s.signal_strength,
        prr: s.prr,
        total_count: s.total_count,
    }));

    const highCount = signals.filter(s => s.signal_strength === 'HIGH').length;
    const medCount = signals.filter(s => s.signal_strength === 'MEDIUM').length;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Safety Signal Detection</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Proportional Reporting Ratio (PRR) analysis across treatment arms</p>
                </div>
            </div>

            {/* Controls */}
            <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label className="form-label">Trial</label>
                        <select className="form-select" value={trialId} onChange={e => setTrialId(e.target.value)}>
                            <option value="">Select a trial…</option>
                            {(trials ?? []).map((t: any) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                    </div>
                    <button className="btn-primary" onClick={runDetection} disabled={!trialId || loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} /> {loading ? 'Running analysis…' : 'Run Signal Detection'}
                    </button>
                </div>
                {signals.length > 0 && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>
                        Analysis powered by database procedure <code>sp_detect_safety_signals</code>
                    </p>
                )}
            </div>

            {/* Summary KPIs */}
            {signals.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: '1.5rem' }}>
                    {[
                        { label: 'Total Signals', value: signals.length, color: '#6B7280' },
                        { label: 'HIGH Signals', value: highCount, color: '#DC2626' },
                        { label: 'MEDIUM Signals', value: medCount, color: '#F59E0B' },
                    ].map((k, i) => (
                        <div key={i} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: k.color, flexShrink: 0 }} />
                            <div>
                                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: k.color }}>{k.value}</p>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--gray-500)' }}>{k.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {signals.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Signal Table */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title"><Shield size={16} /> Signal Table</h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="sm-table">
                                <thead>
                                    <tr><th>AE Term</th><th>Total</th><th>Tx Arm</th><th>Control</th><th>PRR</th><th>Strength</th></tr>
                                </thead>
                                <tbody>
                                    {signals.map((s: any, i: number) => {
                                        const prr = parseFloat(s.prr) || 0;
                                        const rowBg = prr > 3 ? '#FEF2F2' : prr > 2 ? '#FFFBEB' : 'transparent';
                                        return (
                                            <tr key={i} style={{ background: rowBg, cursor: 'pointer' }} onClick={() => setDrilldownTerm(s.ae_term)}>
                                                <td style={{ fontWeight: 600 }}>{s.ae_term}</td>
                                                <td>{s.total_count}</td>
                                                <td>{s.treatment_count ?? '—'}</td>
                                                <td>{s.control_count ?? '—'}</td>
                                                <td style={{ fontWeight: 700, color: prr > 3 ? '#DC2626' : prr > 2 ? '#F59E0B' : 'inherit' }}>
                                                    {prr.toFixed(2)}
                                                </td>
                                                <td><SeverityBadge level={s.signal_strength} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bubble Chart */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title"><TrendingUp size={16} /> PRR Bubble Chart</h3>
                        </div>
                        <div style={{ padding: '1rem', height: 340 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                    <XAxis dataKey="x" name="Occurrence Count" type="number" label={{ value: 'Count', position: 'insideBottom', offset: -10, fontSize: 11 }} tick={{ fontSize: 11 }} />
                                    <YAxis dataKey="y" name="PRR" label={{ value: 'PRR', angle: -90, position: 'insideLeft', fontSize: 11 }} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<SignalTooltip />} />
                                    <Scatter data={bubbleData} shape={<CustomDot />} />
                                </ScatterChart>
                            </ResponsiveContainer>
                            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--gray-400)', margin: '4px 0 0' }}>
                                🔴 HIGH · 🟡 MEDIUM · 🟢 LOW · Size = Signal Strength
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!signals.length && !loading && (
                <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <Shield size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ fontWeight: 600 }}>Select a trial and run signal detection to see results</p>
                </div>
            )}

            {drilldownTerm && (
                <>
                    <div onClick={() => setDrilldownTerm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 999 }} />
                    <DrilldownPanel aeTerm={drilldownTerm} trialId={trialId} onClose={() => setDrilldownTerm(null)} />
                </>
            )}
        </div>
    );
};

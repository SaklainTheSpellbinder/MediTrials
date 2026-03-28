import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Download, AlertCircle, Activity, BarChart2 } from 'lucide-react';
import '../Dashboard.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

const GRADE_COLORS = { 1: '#3B82F6', 2: '#0D9488', 3: '#F59E0B', 4: '#F97316', 5: '#DC2626' };
const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#DC2626', '#8B5CF6'];

export const SafetyReports: React.FC = () => {
    const [trialId, setTrialId] = useState('');
    const [cutoffDate, setCutoffDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportType, setReportType] = useState('Standard Safety Report');
    const [generated, setGenerated] = useState(false);
    const [generating, setGenerating] = useState(false);

    const { data: trials } = useQuery({ queryKey: ['safety-trials'], queryFn: () => safetyApi.get('/api/safety/trials').then(r => r.data) });

    const [reportData, setReportData] = useState<any>(null);

    const handleGenerate = async () => {
        if (!trialId) return;
        setGenerating(true);
        try {
            const r = await safetyApi.get('/api/safety/reports/generate', { params: { trial_id: trialId, cutoff_date: cutoffDate } });
            setReportData(r.data);
            setGenerated(true);
        } finally {
            setGenerating(false);
        }
    };

    const handleExportJSON = () => {
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `safety_report_${trialId}_${cutoffDate}.json`; a.click();
    };

    const report = reportData?.report ?? {};
    const trialName = (trials ?? []).find((t: any) => String(t.trial_id) === String(trialId))?.trial_title ?? '';

    // Grade chart data
    const gradeData = (reportData?.aeBySeverity ?? []).map((r: any) => ({
        name: `Grade ${r.severity_grade}`, count: parseInt(r.count) || 0,
        fill: (GRADE_COLORS as any)[r.severity_grade] ?? '#6B7280',
    }));

    // Causality pie data
    const causalityData = (report.by_causality ?? []).map((r: any, i: number) => ({
        name: r.causality_relationship ?? 'Unknown', value: parseInt(r.count) || 0,
        fill: PIE_COLORS[i % PIE_COLORS.length],
    }));

    // AE by arm data
    const armTerms = [...new Set((reportData?.aeByArm ?? []).map((r: any) => r.ae_term))].slice(0, 8);
    const arms = [...new Set((reportData?.aeByArm ?? []).map((r: any) => r.arm_code))];
    const armChartData = armTerms.map(term => {
        const row: any = { name: term };
        arms.forEach(arm => {
            const match = (reportData?.aeByArm ?? []).find((r: any) => r.ae_term === term && r.arm_code === arm);
            row[arm as string] = parseInt(match?.occurrence_count) || 0;
        });
        return row;
    });

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Safety Report Generator</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Generate regulatory safety reports powered by <code>sp_generate_safety_report</code></p>
                </div>
                {generated && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={window.print} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Download size={15} /> Download PDF
                        </button>
                        <button className="btn-secondary" onClick={handleExportJSON} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={15} /> Export JSON
                        </button>
                    </div>
                )}
            </div>

            {/* Configuration panel */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
                    <div>
                        <label className="form-label">Trial <span style={{ color: '#DC2626' }}>*</span></label>
                        <select className="form-select" value={trialId} onChange={e => { setTrialId(e.target.value); setGenerated(false); }}>
                            <option value="">Select trial…</option>
                            {(trials ?? []).map((t: any) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Data Cutoff Date</label>
                        <input className="form-input" type="date" value={cutoffDate} onChange={e => { setCutoffDate(e.target.value); setGenerated(false); }} />
                    </div>
                    <div>
                        <label className="form-label">Report Type</label>
                        <select className="form-select" value={reportType} onChange={e => setReportType(e.target.value)}>
                            {['Standard Safety Report', 'SAE Summary', 'Signal Report'].map(r => <option key={r}>{r}</option>)}
                        </select>
                    </div>
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        disabled={!trialId || generating} onClick={handleGenerate}>
                        <Activity size={16} /> {generating ? 'Generating…' : 'Generate Report'}
                    </button>
                </div>
                {generating && <p style={{ margin: '10px 0 0', color: 'var(--gray-500)', fontSize: '0.8rem', fontStyle: 'italic' }}>Running signal detection analysis…</p>}
            </div>

            {/* Report content */}
            {generated && reportData && (
                <div id="report-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Report header */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h2 style={{ margin: '0 0 6px', fontWeight: 800 }}>{reportType}</h2>
                                <h3 style={{ margin: '0 0 4px', color: 'var(--gray-600)', fontWeight: 500 }}>{trialName}</h3>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                <p style={{ margin: '0 0 3px' }}>Cutoff Date: <strong>{reportData.cutoff_date}</strong></p>
                                <p style={{ margin: '0 0 3px' }}>Generated: <strong>{new Date().toISOString().split('T')[0]}</strong></p>
                                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.72rem' }}>Powered by sp_generate_safety_report</p>
                            </div>
                        </div>

                        {/* KPI Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: '1rem' }}>
                            {[
                                { label: 'Total AEs', value: report.total_ae ?? report.summary?.total_ae ?? '—', color: '#3B82F6' },
                                { label: 'Serious AEs', value: report.total_sae ?? report.summary?.total_sae ?? '—', color: '#F59E0B' },
                                { label: 'Deaths', value: report.ae_deaths ?? report.summary?.ae_deaths ?? '—', color: '#DC2626' },
                                { label: 'Active Alerts', value: report.active_alerts ?? report.summary?.active_alerts ?? '—', color: '#8B5CF6' },
                            ].map((k, i) => (
                                <div key={i} style={{ background: 'var(--gray-50)', borderRadius: 10, padding: '1rem', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
                                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: k.color }}>{k.value}</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--gray-500)' }}>{k.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Charts row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {/* AE by Severity */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><AlertCircle size={16} /> AE by Severity Grade</h3>
                            </div>
                            <div style={{ padding: '1rem', height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={gradeData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Count" radius={[0, 3, 3, 0]}>
                                            {gradeData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Causality pie */}
                        {causalityData.length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title"><Activity size={16} /> AE by Causality</h3>
                                </div>
                                <div style={{ padding: '1rem', height: 240, display: 'flex', alignItems: 'center' }}>
                                    <ResponsiveContainer width="60%" height="100%">
                                        <PieChart>
                                            <Pie data={causalityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                                                {causalityData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {causalityData.map((d: any, i: number) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.72rem', color: 'var(--gray-600)', flex: 1 }}>{d.name}</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* AE by Treatment Arm */}
                    {armChartData.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><BarChart2 size={16} /> AE by Treatment Arm (Top 8 Terms)</h3>
                            </div>
                            <div style={{ padding: '1rem', height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={armChartData} margin={{ left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        {arms.map((arm: any, i: number) => (
                                            <Bar key={arm} dataKey={arm} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[2, 2, 0, 0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Protocol Deviations */}
                    {(reportData?.deviations ?? []).length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Protocol Deviations</h3>
                            </div>
                            <table className="sm-table">
                                <thead><tr><th>Deviation Type</th><th>Count</th></tr></thead>
                                <tbody>
                                    {reportData.deviations.map((d: any, i: number) => (
                                        <tr key={i}><td>{d.deviation_type}</td><td style={{ fontWeight: 700 }}>{d.count}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!generated && !generating && (
                <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <FileText size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ fontWeight: 600 }}>Configure options above and click Generate Report</p>
                </div>
            )}
        </div>
    );
};

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import '../statistician-pages.css';
import { statisticsAPI } from '../../services/api';


export interface TrialData {
    trial_id: string;
    trial_title: string;
}

export interface EnrollmentContext {
    trial_id: number;
    trial_title: string;
    target_enrollment: number;
    total_enrolled: number;
    site_count: number;
}

export interface PowerAnalysisResult {
    requiredSampleSize: number;
    currentPower: number | null;
    effectSize: number;
    alpha: number;
    powerTarget: number;
    _procedure: string;
}

export const PowerAnalysis: React.FC = () => {
    const { user } = useAuth();
    const qc = useQueryClient();
    
    const [trialId, setTrialId] = useState<string>('');
    const [effectSize, setEffectSize] = useState<number>(0.5);
    const [alpha, setAlpha] = useState<number>(0.05);
    const [powerTarget, setPowerTarget] = useState<number>(0.8);
    
    const [results, setResults] = useState<PowerAnalysisResult | null>(null);
    const [msg, setMsg] = useState('');

    const { data: trials = [] } = useQuery<TrialData[]>({
        queryKey: ['stat-trials'],
        queryFn: () => statisticsAPI.getTrials()
    });

    const { data: enrollmentContext, refetch: getEnrollment } = useQuery<EnrollmentContext>({
        queryKey: ['stat-enrollment', trialId],
        queryFn: () => statisticsAPI.getEnrollmentContext(trialId),
        enabled: !!trialId
    });

    const runMut = useMutation({
        mutationFn: () => statisticsAPI.runPowerAnalysis({
            trial_id: parseInt(trialId),
            effect_size: effectSize,
            alpha,
            power_target: powerTarget
        }),
        onSuccess: (res) => {
            setResults(res);
            setMsg('');
            getEnrollment();
        },
        onError: (e: any) => {
            console.error('API Error:', e);
            // Fallback calculation if SP fails
            const err = e.response?.data?.error ?? e.message;
            if (err.includes("sp_calculate_power_analysis")) {
                calcClientSide();
                setMsg('Stored Procedure failed. Evaluated using client-side estimation.');
            } else {
                setMsg(err);
            }
        }
    });

    // Fallback normal CDF inverse based formula for required sample size
    const calcClientSide = () => {
        const pNormInv = () => {
            // Simplified inverse normal CDF for alpha/power (assuming two-tailed alpha)
            const map: Record<string, number> = {
                '0.05_0.8': 7.85, '0.05_0.9': 10.51, '0.05_0.7': 6.18,
                '0.025_0.8': 10.51, '0.025_0.9': 13.0, '0.025_0.7': 8.5,
                '0.01_0.8': 11.68, '0.01_0.9': 14.88, '0.01_0.7': 9.2,
            };
            return map[`${alpha}_${powerTarget}`] || 7.85;
        };
        const f = pNormInv();
        const req = Math.ceil(2 * f / (effectSize * effectSize));
        setResults({ 
            requiredSampleSize: req, 
            currentPower: null, 
            effectSize, 
            alpha, 
            powerTarget, 
            _procedure: 'client-side' 
        });
    };

    if (user?.role !== 'Statistician') return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Access Denied. Statistician role required.</div>;

    // Power Gauge Component
    const PowerGauge = ({ value }: { value: number }) => {
        const val = value ? Math.min(Math.round(value * 100), 100) : 0;
        const color = val >= 80 ? '#065F46' : val >= 50 ? '#F59E0B' : '#DC2626';
        const fill = val >= 80 ? '#D1FAE5' : val >= 50 ? '#FEF3C7' : '#FEE2E2';
        return (
            <div className="power-gauge-wrap" style={{ width: 180, height: 180, margin: '0 auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: 'Power', value: val, fill }]} startAngle={180} endAngle={0}>
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        {/* @ts-ignore Recharts RadialBar has minAngle prop but types might be outdated */}
                        <RadialBar minAngle={15} background={{ fill: '#F3F4F6' }} clockWise dataKey="value" />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="power-gauge-center">
                    <div className="power-gauge-pct" style={{ color }}>{val}%</div>
                    <div className="power-gauge-label">ACTUAL POWER</div>
                </div>
            </div>
        );
    };

    // Client-side generated sensitivity table
    const generateSensitivity = () => {
        const sz = [0.2, 0.5, 0.8]; // Small, Medium, Large
        const alphas = [0.01, 0.025, 0.05];
        return sz.map((s, i) => (
            <tr key={i}>
                <td className="row-label">Effect: {s}</td>
                {alphas.map((a, j) => {
                    const f = (a === 0.05) ? 7.85 : (a === 0.025 ? 10.51 : 11.68);
                    const n = Math.ceil(2 * f / (s * s));
                    const isCurrent = s === effectSize && a === alpha;
                    return <td key={j} className={isCurrent ? 'current-cell' : ''}>{n}</td>;
                })}
            </tr>
        ));
    };

    const isCurrentMet = results && enrollmentContext && (enrollmentContext.total_enrolled >= results.requiredSampleSize);
    const gap = results && enrollmentContext ? Math.max(0, results.requiredSampleSize - enrollmentContext.total_enrolled) : 0;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Power Analysis</h1>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>Sample size estimation and study power evaluation.</p>
                </div>
            </div>

            <div className="stat-split-layout stat-split-50-50">
                {/* CALCULATOR PANEL */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Activity size={18} /> Configuration Parameters</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ marginBottom: 20 }}>
                            <label className="stat-controls-bar" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Trial Context</span>
                            </label>
                            <select className="form-input" style={{ width: '100%', fontSize: 14, padding: 10 }} value={trialId} onChange={e => setTrialId(e.target.value)}>
                                <option value="">Select trial to analyze...</option>
                                {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: 30 }}>
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span>Expected Effect Size (Cohen's d)</span>
                                <span style={{ color: '#3B82F6', fontWeight: 800 }}>{effectSize.toFixed(2)}</span>
                            </label>
                            <div className="effect-slider-wrap">
                                <input type="range" min="0.1" max="1.0" step="0.05" className="effect-slider" value={effectSize} onChange={e => setEffectSize(parseFloat(e.target.value))} />
                                <div className="slider-labels">
                                    <span>0.1 (Small)</span>
                                    <span>0.5 (Medium)</span>
                                    <span>1.0 (Large)</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 30 }}>
                            <label className="form-label">Significance Level (α)</label>
                            <div className="radio-group">
                                {[0.01, 0.025, 0.05].map(a => (
                                    <div key={a} className={`radio-option ${alpha === a ? 'selected' : ''}`} onClick={() => setAlpha(a)}>
                                        <input type="radio" checked={alpha === a} readOnly style={{ display: 'none' }} />
                                        {a}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 30 }}>
                            <label className="form-label">Target Power (1 - β)</label>
                            <div className="radio-group">
                                {[0.7, 0.8, 0.9].map(p => (
                                    <div key={p} className={`radio-option ${powerTarget === p ? 'selected' : ''}`} onClick={() => setPowerTarget(p)}>
                                        <input type="radio" checked={powerTarget === p} readOnly style={{ display: 'none' }} />
                                        {p * 100}%
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="btn-primary" style={{ width: '100%', padding: '12px 0', fontSize: 14, display: 'flex', justifyContent: 'center', gap: 8 }} onClick={() => runMut.mutate()} disabled={!trialId || runMut.isPending}>
                            <TrendingUp size={16} /> {runMut.isPending ? 'Calculating...' : 'Run Power Analysis'}
                        </button>
                        {msg && <p style={{ color: msg.includes('failed') ? '#92400E' : '#DC2626', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{msg}</p>}

                        <p className="proc-caption" style={{ textAlign: 'center', marginTop: 16 }}>Calculations provided by stored procedure: sp_calculate_power_analysis</p>
                    </div>
                </div>

                {/* RESULTS PANEL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Analysis Results</h3>
                        </div>
                        <div className="card-body">
                            {!results ? (
                                <div className="stat-empty-state" style={{ padding: '24px 0' }}>
                                    <Activity size={32} />
                                    <div className="stat-empty-title">Awaiting calculation</div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                                        <div style={{ flex: 1, padding: 16, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>Req. Sample Size (N)</div>
                                            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>{results.requiredSampleSize}</div>
                                        </div>
                                        <div style={{ flex: 1, padding: 16, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>Power Target</div>
                                            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#1E40AF', lineHeight: 1 }}>{results.powerTarget * 100}%</div>
                                        </div>
                                    </div>

                                    {enrollmentContext && (
                                        <div style={{ padding: 16, border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 20 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Current Enrollment: {enrollmentContext.total_enrolled}</span>
                                                {isCurrentMet ? (
                                                    <span className="power-adequate" style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Adequate</span>
                                                ) : (
                                                    <span className="power-inadequate" style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Inadequate</span>
                                                )}
                                            </div>
                                            <div className="enroll-gap-bar">
                                                <div className="enroll-gap-fill" style={{ width: `${Math.min(100, (enrollmentContext.total_enrolled / results.requiredSampleSize) * 100)}%`, background: isCurrentMet ? '#10B981' : '#F59E0B' }} />
                                            </div>
                                            {!isCurrentMet && (
                                                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                                                    Gap: {gap} patients remaining to reach minimum sample size.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {results.currentPower !== null && (
                                        <div style={{ marginTop: 12, marginBottom: 8 }}>
                                            <PowerGauge value={results.currentPower} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SENSITIVITY ANALYSIS */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Sensitivity Analysis (Sample Sizes)</h3>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            <table className="sensitivity-table">
                                <thead>
                                    <tr>
                                        <th style={{ background: 'white' }}></th>
                                        <th colSpan={3}>Significance Level (α)</th>
                                    </tr>
                                    <tr>
                                        <th>Effect Size</th>
                                        <th>0.01</th>
                                        <th>0.025</th>
                                        <th>0.05</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generateSensitivity()}
                                </tbody>
                            </table>
                            <div style={{ padding: '8px 12px', fontSize: 10, color: '#9CA3AF', background: '#F9FAFB' }}>
                                Highlighted cell matches current generator parameters. Display assumes Power = 80%.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
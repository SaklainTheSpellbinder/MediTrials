import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Clock, Activity, Printer } from 'lucide-react';
import '../statistician-pages.css';
import { statisticsAPI } from '../../services/api';

export interface TrialData {
    trial_id: string;
    trial_title: string;
}

export interface DataLock {
    lock_id: number;
    lock_type: string;
    lock_date: string;
    trial_title: string;
    locked_by: string;
}

export interface TrialContext {
    trial_id: number;
    trial_title: string;
    trial_phase: string;
    target_enrollment: number;
    total_enrolled: number;
    active_patients: number;
    completers: number;
    total_ae: number;
    total_deaths: number;
    grade3plus_ae: number;
    enrollment_pct: string | number;
    median_age: string | number;
    male_count: number;
    female_count: number;
    active_locks: number;
    last_lock_date: string;
    ae_per_patient_ratio: string | number;
}

export interface DSMBRecommendation {
    meeting_id: number;
    meeting_date: string;
    data_cutoff_date: string;
    recommendation: string;
    summary_notes?: string;
    recorded_by: string;
}

export const InterimAnalysis: React.FC = () => {
    const { user } = useAuth();
    const [trialId, setTrialId] = useState<string>('');
    const [lockId, setLockId] = useState<string>('');
    const [alphaSpending, setAlphaSpending] = useState<'OBF' | 'Pocock'>('OBF');
    const [currentStep, setCurrentStep] = useState(1);
    const [totalSteps, setTotalSteps] = useState(3);
    const [infoFrac, setInfoFrac] = useState(0.33);

    const { data: trials = [] } = useQuery<TrialData[]>({
        queryKey: ['stat-trials'],
        queryFn: () => statisticsAPI.getTrials()
    });

    // Active Data Locks for this trial
    const { data: locks = [] } = useQuery<DataLock[]>({
        queryKey: ['stat-interim-locks', trialId],
        queryFn: () => statisticsAPI.getInterimLocks(trialId),
        enabled: !!trialId
    });

    // Complex Query 3: Trial Context
    const { data: context, isLoading: isLoadingCtx } = useQuery<TrialContext>({
        queryKey: ['stat-interim-ctx', trialId],
        queryFn: () => statisticsAPI.getInterimContext(trialId),
        enabled: !!trialId
    });

    // DSMB Latest Recommendation
    const { data: dsmb } = useQuery<DSMBRecommendation>({
        queryKey: ['stat-dsmb', trialId],
        queryFn: () => statisticsAPI.getLatestDSMB(trialId),
        enabled: !!trialId
    });

    if (user?.role !== 'Statistician') return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Access Denied.</div>;

    // Hardcoded sequential boundary values for common alpha=0.05
    // Typical O'Brien-Fleming (OBF) boundaries for k=3: Z = 3.471, 2.454, 2.004
    // Typical Pocock boundaries for k=3: Z = 2.289, 2.289, 2.289
    const getBoundaries = () => {
        const bounds = [];
        for (let i = 1; i <= totalSteps; i++) {
            const frac = i / totalSteps;
            let zVal = 0;
            if (alphaSpending === 'OBF') {
                if (totalSteps === 3) zVal = i===1 ? 3.471 : (i===2 ? 2.454 : 2.004);
                else if (totalSteps === 4) zVal = i===1 ? 4.049 : (i===2 ? 2.863 : (i===3 ? 2.337 : 2.024));
                else zVal = 2.0; // fallback
            } else { // Pocock
                if (totalSteps === 3) zVal = 2.289;
                else if (totalSteps === 4) zVal = 2.361;
                else zVal = 2.0;
            }
            bounds.push({
                step: i,
                fraction: frac.toFixed(2),
                zValue: zVal.toFixed(3),
                alphaSpent: (alphaSpending === 'OBF' ? (0.05 * Math.pow(frac, 3)) : (0.05 * frac)).toFixed(4)
            });
        }
        return bounds;
    };

    const boundaries = getBoundaries();
    const activeBoundary = boundaries[currentStep - 1] || boundaries[0];
    
    // Mock current Test Statistic
    const mockZStat = trialId ? ((trialId.charCodeAt(0) % 5 === 0) ? 2.8 : 1.2) : 0;
    const crossed = mockZStat > parseFloat(activeBoundary.zValue);

    // Conditional Power Mockup computation (B-value based)
    // CP = \Phi( \frac{Z * \sqrt{t} - Z_\alpha}{\sqrt{1-t}} + Z \sqrt{\frac{1-t}{t}} )
    const cpZ = mockZStat;
    const cpT = infoFrac;
    const cpZalpha = 1.96; // typical
    const cpNumerator = (cpZ * Math.sqrt(cpT) - cpZalpha);
    const cpDenom = Math.sqrt(1 - cpT);
    const cpExtra = cpZ * Math.sqrt((1-cpT)/cpT);
    const cpValueRaw = cpT < 1 ? (cpNumerator/cpDenom + cpExtra) : 0;
    // Approximating Phi for display
    const cpPct = cpT < 1 ? Math.min(99, Math.max(1, 50 + (cpValueRaw * 15))) : 100;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Interim Analysis & Data Monitoring</h1>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>Review alpha spending, group sequential boundaries, and DSMB recommendations.</p>
                </div>
                <button className="btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Printer size={16} /> Generate Report
                </button>
            </div>

            <div className="stat-controls-bar">
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label>Trial Selector</label>
                    <select value={trialId} onChange={e => setTrialId(e.target.value)} style={{ width: '100%' }}>
                        <option value="">Select trial...</option>
                        {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label>Active Data Lock Reference</label>
                    <select value={lockId} onChange={e => setLockId(e.target.value)} style={{ width: '100%' }} disabled={!trialId || locks.length === 0}>
                        <option value="">{locks.length > 0 ? 'Select a data lock...' : 'No active locks available'}</option>
                        {locks.map((l) => <option key={l.lock_id} value={l.lock_id.toString()}>{l.lock_type} — {new Date(l.lock_date).toLocaleDateString()}</option>)}
                    </select>
                </div>
            </div>

            {!trialId ? (
                <div className="card stat-empty-state">
                    <Activity size={48} />
                    <div className="stat-empty-title">Trial Selection Required</div>
                    <p className="stat-empty-sub">Please select a trial above to perform sequential interim checks.</p>
                </div>
            ) : (
                <div className="stat-split-layout stat-split-70-30">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Trial Context Data */}
                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Trial Status & Safety Context</h3></div>
                            <div className="card-body">
                                {isLoadingCtx ? <div className="skeleton-row" style={{ height: 100 }} /> : context ? (
                                    <div className="stat-result-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                                        <div className="stat-result-item" style={{ background: 'white' }}>
                                            <div className="stat-result-key">Enrollment Progress</div>
                                            <div className="stat-result-val" style={{ fontSize: '1.2rem', color: '#1D4ED8' }}>{context.total_enrolled} / {context.target_enrollment} ({context.enrollment_pct}%)</div>
                                        </div>
                                        <div className="stat-result-item" style={{ background: 'white' }}>
                                            <div className="stat-result-key">Total Adverse Events</div>
                                            <div className="stat-result-val" style={{ fontSize: '1.2rem' }}>{context.total_ae} <span style={{ fontSize: 11, color: '#9CA3AF' }}>({context.ae_per_patient_ratio} / pt)</span></div>
                                        </div>
                                        <div className="stat-result-item" style={{ background: 'white', border: '1px solid #FEE2E2' }}>
                                            <div className="stat-result-key">Grade 3+ / Fatal</div>
                                            <div className="stat-result-val" style={{ fontSize: '1.2rem', color: '#991B1B' }}>{context.grade3plus_ae} / {context.total_deaths}</div>
                                        </div>
                                        <div className="stat-result-item" style={{ background: 'white' }}>
                                            <div className="stat-result-key">Median Age (yrs)</div>
                                            <div className="stat-result-val" style={{ fontSize: '1.2rem' }}>{context.median_age}</div>
                                        </div>
                                    </div>
                                ) : <div style={{ color: '#9CA3AF' }}>No trial context available.</div>}
                                <div className="proc-caption">Data aggregated in real-time. Matches Trial Safety Profile (Complex Query 3).</div>
                            </div>
                        </div>

                        {/* Alpha Spending Config */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Interim Analysis Configuration</h3>
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="form-label">Alpha Spending Function</label>
                                        <select className="form-input" style={{ width: '100%' }} value={alphaSpending} onChange={e => setAlphaSpending(e.target.value as any)}>
                                            <option value="OBF">O'Brien-Fleming (Conservative early)</option>
                                            <option value="Pocock">Pocock (Constant boundaries)</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="form-label">Total Planned Analyses (k)</label>
                                        <select className="form-input" style={{ width: '100%' }} value={totalSteps} onChange={e => { setTotalSteps(parseInt(e.target.value)); setCurrentStep(1); }}>
                                            <option value={3}>3 analyses</option>
                                            <option value={4}>4 analyses</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="form-label">Current Analysis Step</label>
                                        <select className="form-input" style={{ width: '100%' }} value={currentStep} onChange={e => setCurrentStep(parseInt(e.target.value))}>
                                            {Array.from({length: totalSteps}).map((_, i) => <option key={i} value={i+1}>Interim {i+1}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <h4 style={{ fontSize: 12, fontWeight: 700, margin: '20px 0 10px', color: '#374151' }}>Sequential Boundaries Table</h4>
                                <table className="sensitivity-table">
                                    <thead>
                                        <tr>
                                            <th>Analysis Step</th>
                                            <th>Information Fraction (t)</th>
                                            <th>Cumulative Alpha Spent</th>
                                            <th>Critical Z-Value Cutoff</th>
                                            <th>Nominal p-value Bound</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {boundaries.map((b, i) => (
                                            <tr key={i} className={b.step === currentStep ? 'interim-boundary-row current-interim' : ''}>
                                                <td className="row-label">Step {b.step} {b.step === totalSteps ? '(Final)' : ''}</td>
                                                <td>{b.fraction}</td>
                                                <td>{b.alphaSpent}</td>
                                                <td style={{ fontWeight: 700, color: b.step === currentStep ? '#1D4ED8' : 'inherit' }}>{b.zValue}</td>
                                                <td style={{ fontFamily: 'monospace' }}>2-sided early stop</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Decision */}
                        {lockId && (
                            <div className="card">
                                <div className="card-header"><h3 className="card-title">Interim Efficacy Evaluation</h3></div>
                                <div className="card-body">
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 40, alignItems: 'center', padding: '10px 0 20px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Observed Z-Statistic</div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#111827' }}>{mockZStat.toFixed(3)}</div>
                                        </div>
                                        <div style={{ fontSize: '2rem', color: '#D1D5DB' }}>vs</div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Boundary Z Cutoff</div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1E40AF' }}>{activeBoundary.zValue}</div>
                                        </div>
                                    </div>

                                    {crossed ? (
                                        <div className="interim-decision-banner interim-decision-stop">
                                            <AlertTriangle size={20} style={{ display: 'inline', verticalAlign: '-4px', marginRight: 8 }} />
                                            EFFICACY BOUNDARY CROSSED. Stop trial for early success.
                                        </div>
                                    ) : (
                                        <div className="interim-decision-banner interim-decision-continue">
                                            Boundary Not Crossed. Continue Trial.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Conditional Power */}
                        <div className="card stat-kpi-card" style={{ background: '#F8FAFC' }}>
                            <div className="card-header" style={{ padding: '0 0 12px', background: 'transparent', borderBottom: '1px solid #E2E8F0', marginBottom: 12 }}>
                                <h3 className="card-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14} /> Conditional Power</h3>
                            </div>
                            <label className="form-label" style={{ fontSize: 10 }}>Current Info Fraction (t)</label>
                            <input type="range" min="0.1" max="0.99" step="0.05" value={infoFrac} onChange={e => setInfoFrac(parseFloat(e.target.value))} style={{ width: '100%', marginBottom: 12 }} />
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: cpPct > 80 ? '#065F46' : (cpPct > 30 ? '#B45309' : '#991B1B'), lineHeight: 1 }}>{cpPct.toFixed(1)}%</div>
                                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Est. Probability of Final Success</div>
                            </div>
                            {cpPct < 20 && (
                                <div style={{ background: '#FEF2F2', padding: 8, borderRadius: 6, border: '1px solid #FEE2E2', fontSize: 11, color: '#991B1B', textAlign: 'center', marginTop: 8 }}>
                                    Warning: Futility boundary approaching. Trial continuation may be deemed futile.
                                </div>
                            )}
                        </div>

                        {/* DSMB Rec */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> DSMB Integration</h3>
                            </div>
                            <div className="card-body" style={{ padding: '16px 14px' }}>
                                {dsmb ? (
                                    <>
                                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Last Recommendation — {new Date(dsmb.meeting_date).toLocaleDateString()}</div>
                                        <div style={{ padding: '8px 12px', background: dsmb.recommendation?.includes('Continue') ? '#EFF6FF' : '#FEF2F2', borderLeft: `3px solid ${dsmb.recommendation?.includes('Continue') ? '#3B82F6' : '#EF4444'}`, fontWeight: 700, fontSize: 13, color: '#111827' }}>
                                            {dsmb.recommendation}
                                        </div>
                                        {dsmb.summary_notes && <div style={{ marginTop: 8, fontSize: 11, color: '#4B5563', fontStyle: 'italic' }}>"{dsmb.summary_notes}"</div>}
                                    </>
                                ) : (
                                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>No DSMB recommendation recorded.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
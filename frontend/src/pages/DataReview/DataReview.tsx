import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
import { RefreshCw, Bell, Shield, CheckCircle, XCircle, BarChart2, X } from 'lucide-react';
import '../Dashboard.css';
import { dataManagerAPI } from '../../services/api';

// --- Type Interfaces ---
export interface TrialData {
    trial_id: number;
    trial_title: string;
}

export interface SiteData {
    site_id: number;
    institution_name: string;
}

export interface CompletenessRow { 
    patient_id: number; 
    trial_patient_id: string; 
    site_id: number; 
    site_name: string; 
    visit_id: number; 
    visit_name: string; 
    visit_number: number; 
    visit_instance_id: number | null; 
    visit_status: string | null; 
    form_count: number; 
    locked_count: number; 
    signed_count: number; 
    completed_count: number; 
    in_progress_count: number; 
    required_forms_count: number; 
}

export interface TrendRow {
    week: string;
    forms_entered: number | string;
    forms_signed: number | string;
    queries_raised: number | string;
    queries_resolved: number | string;
    weekly_sign_rate: number | string;
}

export interface MissingRow { 
    trial_patient_id: string; 
    institution_name: string; 
    total_required_forms: number; 
    completed_forms: number; 
    signed_forms: number; 
    completion_pct: number | string; 
    missing_field_flags: number; 
    open_queries: number; 
    last_activity: string | null; 
}

export interface DeviationRow { 
    deviation_id: number; 
    deviation_type: 'Minor' | 'Major' | 'Critical'; 
    deviation_date: string; 
    description: string; 
    corrective_action: string | null; 
    reported_to_irb: boolean; 
    trial_patient_id: string; 
    site_name: string; 
    reported_by_username: string; 
}
// ------------------------

// ── Shared helpers ─────────────────────────────────────────────────────────────
const devColors: Record<string, { bg: string; color: string }> = {
    Minor:    { bg: '#FEF9C3', color: '#854D0E' },
    Major:    { bg: '#FFEDD5', color: '#9A3412' },
    Critical: { bg: '#FEE2E2', color: '#DC2626' },
};
const DevBadge = ({ type }: { type: string }) => {
    const { bg, color } = devColors[type] ?? { bg: '#F3F4F6', color: '#374151' };
    return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{type}</span>;
};

// Cell color logic for eCRF matrix
function cellColor(row: CompletenessRow): { bg: string; label: string; textColor: string } {
    if (!row.visit_instance_id) return { bg: '#F3F4F6', label: '—', textColor: '#9CA3AF' };
    if (row.locked_count > 0 && row.locked_count === row.form_count) return { bg: '#166534', label: 'L', textColor: 'white' };
    if (row.signed_count > 0 && row.signed_count === row.form_count) return { bg: '#16A34A', label: 'S', textColor: 'white' };
    if (row.completed_count > 0 && row.completed_count === row.form_count) return { bg: '#3B82F6', label: 'C', textColor: 'white' };
    if (row.in_progress_count > 0) return { bg: '#F59E0B', label: 'P', textColor: 'white' };
    if (row.form_count === 0 && row.required_forms_count > 0) return { bg: '#FEE2E2', label: '!', textColor: '#DC2626' };
    return { bg: '#E5E7EB', label: '?', textColor: '#6B7280' };
}

// ── 21 CFR E-Signature Modal ───────────────────────────────────────────────────
const ESignModal: React.FC<{ title: string; onConfirm: (reason: string) => void; onClose: () => void; loading?: boolean }> = ({ title, onConfirm, onClose, loading }) => {
    const [reason, setReason] = useState('');
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <label className="form-label">Reason for change <span style={{ color: '#DC2626' }}>*</span></label>
                <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for 21 CFR Part 11 audit trail" style={{ resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" disabled={!reason.trim() || loading} onClick={() => onConfirm(reason)}>{loading ? 'Saving…' : 'Confirm'}</button>
                </div>
            </div>
        </div>
    );
};

// ── Sub-tab 1: eCRF Completeness Matrix ────────────────────────────────────────
const ECRFCompletenessMatrix: React.FC<{ trialId: string }> = ({ trialId }) => {
    const { data: rows = [], isLoading, refetch } = useQuery<CompletenessRow[]>({
        queryKey: ['ecrf-completeness', trialId],
        queryFn: () => dataManagerAPI.getCompleteness(trialId),
        enabled: !!trialId,
    });
    const { data: trendData = [] } = useQuery<TrendRow[]>({
        queryKey: ['trend', trialId],
        queryFn: () => dataManagerAPI.getCompletenessTrend(trialId),
        enabled: !!trialId,
    });

    // Build matrix: unique patients × unique visits
    const patients = [...new Map(rows.map(r => [r.patient_id, { id: r.patient_id, pid: r.trial_patient_id, site: r.site_name }])).values()];
    const visits   = [...new Map(rows.map(r => [r.visit_id, { id: r.visit_id, name: r.visit_name, num: r.visit_number }])).values()].sort((a, b) => a.num - b.num);
    const cellMap: Map<string, CompletenessRow> = new Map(rows.map(r => [`${r.patient_id}-${r.visit_id}`, r]));

    const totalForms     = rows.reduce((s, r) => s + Number(r.form_count), 0);
    const completedForms = rows.reduce((s, r) => s + Number(r.completed_count) + Number(r.signed_count) + Number(r.locked_count), 0);
    const signedForms    = rows.reduce((s, r) => s + Number(r.signed_count), 0);
    const visitInstances = new Set(rows.filter(r => r.visit_instance_id).map(r => r.visit_instance_id)).size;

    if (!trialId) return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Select a trial to view the completeness matrix.</div>;

    return (
        <div>
            {/* Data Quality Trend Chart — Complex Query 3 */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <h3 className="card-title"><BarChart2 size={16} /> Data Quality Trend (Last 6 Months)</h3>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Complex Query 3 — Weekly aggregation</span>
                </div>
                <div style={{ padding: '1rem' }}>
                    {trendData.length === 0 ? (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>No visit data in last 6 months</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                <XAxis dataKey="week" tickFormatter={(v) => v ? new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''} style={{ fontSize: 11 }} stroke="#D1D5DB" />
                                <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v}%`} style={{ fontSize: 11 }} stroke="#D1D5DB" />
                                <YAxis yAxisId="right" orientation="right" style={{ fontSize: 11 }} stroke="#D1D5DB" />
                                <Tooltip 
    formatter={(val: any, name: string | undefined) => name?.includes('rate') ? `${val}%` : val} 
    labelFormatter={(label: any) => label ? new Date(label).toLocaleDateString() : ''} 
/>
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="weekly_sign_rate" name="Sign Rate %" stroke="#16A34A" strokeWidth={2} dot={false} />
                                <Line yAxisId="right" type="monotone" dataKey="queries_raised" name="Queries Raised" stroke="#DC2626" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                <Line yAxisId="right" type="monotone" dataKey="queries_resolved" name="Queries Resolved" stroke="#3B82F6" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.25rem' }}>
                {[
                    { label: 'Visit Instances', val: visitInstances, color: '#3B82F6' },
                    { label: 'Forms Expected', val: totalForms, color: '#6B7280' },
                    { label: 'Forms Completed', val: totalForms > 0 ? `${Math.round(completedForms / totalForms * 100)}%` : '—', color: '#16A34A' },
                    { label: 'Forms Signed', val: totalForms > 0 ? `${Math.round(signedForms / totalForms * 100)}%` : '—', color: '#7C3AED' },
                ].map(({ label, val, color }) => (
                    <div key={label} className="card" style={{ padding: '0.875rem 1rem' }}>
                        <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 700, color }}>{val}</p>
                    </div>
                ))}
            </div>

            {/* Color legend */}
            <div style={{ display: 'flex', gap: 12, marginBottom: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Legend:</span>
                {[['#166534','white','L','Locked'],['#16A34A','white','S','Signed'],['#3B82F6','white','C','Completed'],['#F59E0B','white','P','In Progress'],['#FEE2E2','#DC2626','!','Missing'],['#F3F4F6','#9CA3AF','—','Not Scheduled']].map(([bg, tc, l, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ background: bg, color: tc, width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{l}</span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* Refresh + matrix */}
            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="card-header">
                    <h3 className="card-title">eCRF Completeness Matrix</h3>
                    <button className="btn-secondary" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, padding: '4px 12px' }} onClick={() => refetch()}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>
                {isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading matrix…</div>
                ) : patients.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>No patient data for this trial.</div>
                ) : (
                    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 500 }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ background: '#F9FAFB' }}>
                                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', position: 'sticky', left: 0, background: '#F9FAFB', borderRight: '2px solid #E5E7EB', zIndex: 11 }}>Patient</th>
                                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', position: 'sticky', left: 90, background: '#F9FAFB', borderRight: '1px solid #E5E7EB', zIndex: 11 }}>Site</th>
                                    {visits.map(v => <th key={v.id} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: '#374151', minWidth: 70, borderBottom: '1px solid #E5E7EB' }}>{v.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((p, pi) => (
                                    <tr key={p.id} style={{ background: pi % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                        <td style={{ padding: '6px 14px', fontWeight: 700, fontSize: 12, position: 'sticky', left: 0, background: pi % 2 === 0 ? 'white' : '#FAFAFA', borderRight: '2px solid #E5E7EB', zIndex: 5 }}>{p.pid}</td>
                                        <td style={{ padding: '6px 14px', fontSize: 11, color: '#6B7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', left: 90, background: pi % 2 === 0 ? 'white' : '#FAFAFA', borderRight: '1px solid #E5E7EB', zIndex: 5 }}>{p.site}</td>
                                        {visits.map(v => {
                                            const cell = cellMap.get(`${p.id}-${v.id}`);
                                            const { bg, label, textColor } = cell ? cellColor(cell) : { bg: '#F3F4F6', label: '—', textColor: '#9CA3AF' };
                                            const tooltip = cell ? `${cell.form_count} forms: ${cell.locked_count}L ${cell.signed_count}S ${cell.completed_count}C ${cell.in_progress_count}P` : 'No data';
                                            return (
                                                <td key={v.id} title={tooltip} style={{ padding: 4, textAlign: 'center' }}>
                                                    <div style={{ background: bg, color: textColor, width: 36, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto', fontWeight: 700, fontSize: 12, cursor: cell?.visit_instance_id ? 'pointer' : 'default' }}>{label}</div>
                                                </td>
                                            );
                                        })}
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

// ── Sub-tab 2: Missing Data Report ─────────────────────────────────────────────
const MissingDataReport: React.FC<{ trialId: string }> = ({ trialId }) => {
    const [remindMsg, setRemindMsg] = useState('');
    const { data: rows = [], isLoading } = useQuery<MissingRow[]>({
        queryKey: ['missing-data', trialId],
        queryFn: () => dataManagerAPI.getMissingData(trialId),
        enabled: !!trialId,
    });

    const sendReminder = (site: string) => { setRemindMsg(`Reminder sent to ${site}`); setTimeout(() => setRemindMsg(''), 3000); };

    if (!trialId) return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Select a trial above.</div>;

    return (
        <div className="card">
            {remindMsg && (
                <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 16px', borderRadius: 8, margin: '0 0 12px', fontSize: '0.875rem', fontWeight: 500 }}>✓ {remindMsg}</div>
            )}
            <div className="card-header">
                <h3 className="card-title">Missing Data Report</h3>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sorted by worst completeness first</span>
            </div>
            {isLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                    <CheckCircle size={40} style={{ marginBottom: 12, color: '#16A34A' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>All data is complete — excellent!</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ background: '#F9FAFB' }}>
                                {['Patient', 'Site', '% Complete', 'Expected', 'Completed', 'Signed', 'Missing Fields', 'Open Queries', 'Last Activity', ''].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => {
                                const pct = parseFloat(String(r.completion_pct)) || 0;
                                const barColor = pct >= 80 ? '#16A34A' : pct >= 50 ? '#F59E0B' : '#DC2626';
                                return (
                                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.trial_patient_id}</td>
                                        <td style={{ padding: '10px 12px', color: '#6B7280', fontSize: 11 }}>{r.institution_name}</td>
                                        <td style={{ padding: '10px 12px', minWidth: 160 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 99, transition: 'width 0.3s' }} />
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: barColor, minWidth: 36 }}>{pct}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>{r.total_required_forms}</td>
                                        <td style={{ padding: '10px 12px', color: '#16A34A', fontWeight: 600 }}>{r.completed_forms}</td>
                                        <td style={{ padding: '10px 12px', color: '#7C3AED' }}>{r.signed_forms}</td>
                                        <td style={{ padding: '10px 12px', color: r.missing_field_flags > 0 ? '#DC2626' : '#9CA3AF', fontWeight: r.missing_field_flags > 0 ? 700 : 400 }}>{r.missing_field_flags}</td>
                                        <td style={{ padding: '10px 12px', color: r.open_queries > 0 ? '#DC2626' : '#9CA3AF', fontWeight: r.open_queries > 0 ? 700 : 400 }}>{r.open_queries}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF' }}>{r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '—'}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => sendReminder(r.institution_name)}>
                                                <Bell size={11} /> Remind
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ── Sub-tab 3: Protocol Deviations ─────────────────────────────────────────────
const ProtocolDeviations: React.FC<{ trialId: string }> = ({ trialId }) => {
    const qc = useQueryClient();
    const [devType, setDevType]     = useState('');
    const [siteId, setSiteId]       = useState('');
    const [irbFilter, setIrbFilter] = useState('');
    const [dateFrom, setDateFrom]   = useState('');
    const [dateTo, setDateTo]       = useState('');
    const [pendingToggle, setPendingToggle] = useState<{ id: number; val: boolean } | null>(null);

    const params = { trial_id: trialId, type: devType || undefined, site_id: siteId || undefined, irb_reported: irbFilter || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined };

    const { data: rows = [], isLoading } = useQuery<DeviationRow[]>({
        queryKey: ['deviations', params],
        queryFn: () => dataManagerAPI.getDeviations(params),
        enabled: !!trialId,
    });
    const { data: sites = [] } = useQuery<SiteData[]>({ 
        queryKey: ['dm-sites'], 
        queryFn: () => dataManagerAPI.getSites() 
    });

    const toggleMut = useMutation({
        mutationFn: ({ id, val, reason }: { id: number; val: boolean; reason: string }) =>
            dataManagerAPI.updateDeviation(id, { reported_to_irb: val, reason }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['deviations'] }); setPendingToggle(null); },
    });

    if (!trialId) return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Select a trial above.</div>;

    return (
        <div>
            {/* Filter bar */}
            <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '0 0 140px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Type</label>
                        <select className="form-select" value={devType} onChange={e => setDevType(e.target.value)}>
                            <option value="">All Types</option>
                            <option>Minor</option><option>Major</option><option>Critical</option>
                        </select>
                    </div>
                    <div style={{ flex: '0 0 180px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Site</label>
                        <select className="form-select" value={siteId} onChange={e => setSiteId(e.target.value)}>
                            <option value="">All Sites</option>
                            {sites.map((s) => <option key={s.site_id} value={s.site_id}>{s.institution_name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '0 0 160px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>IRB Reported</label>
                        <select className="form-select" value={irbFilter} onChange={e => setIrbFilter(e.target.value)}>
                            <option value="">All</option>
                            <option value="true">Reported</option>
                            <option value="false">Not Reported</option>
                        </select>
                    </div>
                    <div style={{ flex: '0 0 130px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>From</label>
                        <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div style={{ flex: '0 0 130px' }}>
                        <label className="form-label" style={{ fontSize: 11 }}>To</label>
                        <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Shield size={16} /> Protocol Deviations</h3>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>DM can toggle IRB Reported only</span>
                </div>
                {isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
                ) : rows.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>No deviations match filters.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB' }}>
                                    {['ID', 'Patient', 'Site', 'Type', 'Date', 'Description', 'Corrective Action', 'IRB Reported', 'Reported By'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((d, i) => (
                                    <tr key={d.deviation_id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>#{d.deviation_id}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.trial_patient_id}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{d.site_name}</td>
                                        <td style={{ padding: '10px 12px' }}><DevBadge type={d.deviation_type} /></td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>{d.deviation_date?.split('T')[0]}</td>
                                        <td style={{ padding: '10px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={d.description}>{d.description}</td>
                                        <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: d.corrective_action ? '#374151' : '#DC2626', fontStyle: d.corrective_action ? 'normal' : 'italic' }} title={d.corrective_action ?? undefined}>{d.corrective_action ?? 'NOT DOCUMENTED'}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <input type="checkbox" checked={d.reported_to_irb}
                                                onChange={e => setPendingToggle({ id: d.deviation_id, val: e.target.checked })}
                                                style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#16A34A' }} />
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{d.reported_by_username ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 21 CFR modal for IRB toggle */}
            {pendingToggle && (
                <ESignModal
                    title={`${pendingToggle.val ? 'Mark' : 'Unmark'} as Reported to IRB`}
                    loading={toggleMut.isPending}
                    onClose={() => setPendingToggle(null)}
                    onConfirm={(reason) => toggleMut.mutate({ id: pendingToggle.id, val: pendingToggle.val, reason })} />
            )}
        </div>
    );
};

// ── Main DataReview Page ───────────────────────────────────────────────────────
const SUB_TABS = ['eCRF Completeness', 'Missing Data Report', 'Protocol Deviations'] as const;

export const DataReview: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('eCRF Completeness');
    const [trialId, setTrialId]     = useState('');

    const { data: trials = [] } = useQuery<TrialData[]>({ 
        queryKey: ['dm-trials'], 
        queryFn: () => dataManagerAPI.getTrials() 
    });

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Data Review</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>eCRF completeness, missing data, and protocol deviations</p>
                </div>
                <div style={{ minWidth: 240 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Trial</label>
                    <select className="form-select" value={trialId} onChange={e => setTrialId(e.target.value)}>
                        <option value="">Select trial…</option>
                        {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                    </select>
                </div>
            </div>

            {/* Sub-tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: '1.5rem' }}>
                {SUB_TABS.map(tab => {
                    const active = activeTab === tab;
                    return (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: active ? 700 : 500, color: active ? 'var(--color-primary)' : '#6B7280', borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2 }}>
                            {tab}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'eCRF Completeness'     && <ECRFCompletenessMatrix trialId={trialId} />}
            {activeTab === 'Missing Data Report'    && <MissingDataReport trialId={trialId} />}
            {activeTab === 'Protocol Deviations'   && <ProtocolDeviations trialId={trialId} />}
        </div>
    );
};
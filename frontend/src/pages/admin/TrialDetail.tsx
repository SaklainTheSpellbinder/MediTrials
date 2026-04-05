import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Trash2, Edit2, FileText } from 'lucide-react';

import { adminAPI } from '../../services/api';
import '../Dashboard.css';
import './AdminDashboard.css';

const Tab: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
        padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? '#4F46E5' : '#6B7280', background: 'none', border: 'none',
        borderBottom: active ? '2px solid #4F46E5' : '2px solid transparent', cursor: 'pointer',
    }}>{label}</button>
);

const InlineForm: React.FC<{ fields: { name: string; label: string; type?: string }[]; onSubmit: (v: Record<string, any>) => void; loading?: boolean }> = ({ fields, onSubmit, loading }) => {
    const [v, setV] = useState<Record<string, any>>({});
    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 0', borderTop: '1px solid #F3F4F6', marginTop: 8 }}>
            {fields.map(f => (
                <div key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={{ fontSize: 11, color: '#9CA3AF' }}>{f.label}</label>
                    <input type={f.type ?? 'text'} value={v[f.name] ?? ''} onChange={e => setV(p => ({ ...p, [f.name]: e.target.value }))}
                        style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 140 }} />
                </div>
            ))}
            <button onClick={() => { onSubmit(v); setV({}); }} disabled={loading} className="btn-primary" style={{ height: 30, padding: '0 14px', fontSize: 12 }}>
                {loading ? '…' : '+ Add'}
            </button>
        </div>
    );
};

const TABS = ['Overview', 'Sites', 'Protocol', 'Treatment Arms', 'Eligibility', 'Visit Schedule', 'eCRF Defs', 'Lab Tests'];

const BLINDING_OPTIONS = ['Open-label', 'Single-blind', 'Double-blind', 'Triple-blind'];

// Separate add-row for treatment arms so the Blinding field is a <select> not a free text input
const ArmAddRow: React.FC<{ onSubmit: (v: Record<string, any>) => void; loading?: boolean }> = ({ onSubmit, loading }) => {
    const [v, setV] = useState({ arm_code: '', arm_description: '', blinding_level: BLINDING_OPTIONS[0] });
    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 0', borderTop: '1px solid #F3F4F6', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 11, color: '#9CA3AF' }}>Arm Code</label>
                <input value={v.arm_code} onChange={e => setV(p => ({ ...p, arm_code: e.target.value }))}
                    placeholder="e.g. A, B, CTRL" style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 100 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 11, color: '#9CA3AF' }}>Description</label>
                <input value={v.arm_description} onChange={e => setV(p => ({ ...p, arm_description: e.target.value }))}
                    placeholder="Treatment description" style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 180 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 11, color: '#9CA3AF' }}>Blinding</label>
                <select value={v.blinding_level} onChange={e => setV(p => ({ ...p, blinding_level: e.target.value }))}
                    style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 140, background: 'white' }}>
                    {BLINDING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            <button onClick={() => { onSubmit(v); setV({ arm_code: '', arm_description: '', blinding_level: BLINDING_OPTIONS[0] }); }}
                disabled={loading || !v.arm_code} className="btn-primary" style={{ height: 30, padding: '0 14px', fontSize: 12 }}>
                {loading ? '…' : '+ Add'}
            </button>
        </div>
    );
};

export const TrialDetail: React.FC = () => {
    const { trialId } = useParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [tab, setTab] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'trial', trialId],
        queryFn: () => adminAPI.getTrialFull(trialId as string),
    });

    const mut = (path: string) => useMutation({
        mutationFn: (body: any) => adminAPI.addTrialEntity(trialId as string, path, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'trial', trialId] }),
    });

    const addSite = mut('sites');
    const addProtocol = mut('protocols');
    const addArm = mut('arms');
    const addElig = mut('eligibility');
    const addVisit = mut('visits');
    const addLab = mut('lab-tests');
    const addEcrf = mut('ecrf-defs');

    if (isLoading) return <div className="dashboard-container"><div className="sm-loading">Loading trial data…</div></div>;
    if (!data) return <div className="dashboard-container"><div className="sm-error">Trial not found.</div></div>;

    const { trial, sites, protocols, arms, eligibility, visits, ecrfDefs, labTests } = data;
    
    const statusColor: Record<string, string> = { 
        Active: 'admin-badge-green', 
        Recruiting: 'admin-badge-blue', 
        Completed: 'admin-badge-gray', 
        Suspended: 'admin-badge-amber', 
        Terminated: 'admin-badge-red', 
        Design: 'admin-badge-purple' 
    };

    return (
        <div className="dashboard-container">
            {/* HEADER SECTION */}
            <div className="section-header" style={{ marginBottom: 20 }}>
                <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: 12 }}>
                            {trial?.trial_nct_id} 
                        </span>
                        <span className="admin-badge admin-badge-gray">
                            {trial?.trial_phase}
                        </span>
                        <span className={`admin-badge ${statusColor[trial?.trial_status || ''] ?? 'admin-badge-gray'}`}>
                            {trial?.trial_status}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 className="page-title" style={{ margin: 0 }}>
                            {trial?.trial_title}
                        </h1>
                        <button 
                            onClick={() => navigate(`/admin/trials/${trialId}/edit`)}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                            <Edit2 size={14} /> Edit Trial
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION BAR */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: 20, overflowX: 'auto' }}>
                {TABS.map((label, i) => (
                    <Tab key={label} label={label} active={tab === i} onClick={() => setTab(i)} />
                ))}
            </div>
            
            {/* TAB CONTENT */}

            {/* Tab 0 — Overview */}
            {tab === 0 && (
                <div className="card">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 30px' }}>
                        {[
                            ['NCT ID', trial?.trial_nct_id],
                            ['Phase', trial?.trial_phase],
                            ['Therapeutic Area', trial?.therapeutic_area],
                            ['Status', trial?.trial_status],
                            ['Start Date', trial?.start_date?.split('T')[0]],
                            ['Est. Completion', trial?.estimated_completion_date?.split('T')[0]],
                            ['Target Enrollment', trial?.target_enrollment],
                        ].map(([k, v]) => (
                            <div key={k as string}>
                                <label style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>{k}</label>
                                <div style={{ fontWeight: 600, color: '#111827', marginTop: 2 }}>{v ?? '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 1 — Sites */}
            {tab === 1 && (
                <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{['Site', 'Country', 'Target', 'Enrolled', '%', 'Active', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {sites?.map((s: any) => (
                                <tr key={s.site_id}>
                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.institution_name}</td>
                                    <td style={{ padding: '8px 10px', color: '#6B7280' }}>{s.country}</td>
                                    <td style={{ padding: '8px 10px' }}>{s.target_enrollment}</td>
                                    <td style={{ padding: '8px 10px' }}>{s.current_enrollment}</td>
                                    <td style={{ padding: '8px 10px' }}>{s.enrollment_pct}%</td>
                                    <td style={{ padding: '8px 10px' }}>{s.active_patients}</td>
                                    <td style={{ padding: '8px 10px' }}><Link to={`/admin/sites/${s.site_id}`} className="admin-act-btn" style={{ fontSize: 11 }}>Details</Link></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <InlineForm fields={[{ name: 'institution_name', label: 'Site Name' }, { name: 'country', label: 'Country' }, { name: 'target_enrollment', label: 'Target', type: 'number' }, { name: 'initiation_date', label: 'Initiation Date', type: 'date' }]}
                        onSubmit={v => addSite.mutate({ ...v, target_enrollment: Number(v.target_enrollment) })} loading={addSite.isPending} />
                </div>
            )}

            {/* Tab 2 — Protocol */}
            {tab === 2 && (
                <div className="card">
                    <div style={{ fontSize: 12, color: '#6B7280', background: '#FEF3C7', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
                        ℹ️ Uploading a new version automatically invalidates the previous active version.
                    </div>
                    {protocols?.map((p: any) => (
                        <div key={p.protocol_id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 16, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700 }}>v{p.version_number}</span>
                            {p.amendment_number && <span style={{ color: '#6B7280', fontSize: 12 }}>Amend. {p.amendment_number}</span>}
                            <span style={{ color: '#6B7280', fontSize: 12 }}>Effective: {p.valid_from?.split('T')[0]}</span>
                            {!p.valid_to && <span className="admin-badge admin-badge-green" style={{ marginLeft: 'auto' }}>Current</span>}
                            {p.valid_to && <span style={{ color: '#9CA3AF', fontSize: 11, marginLeft: 'auto' }}>Superseded {p.valid_to?.split('T')[0]}</span>}
                        </div>
                    ))}
                    <InlineForm fields={[{ name: 'version_number', label: 'Version' }, { name: 'amendment_number', label: 'Amendment #' }, { name: 'effective_date', label: 'Effective Date', type: 'date' }]}
                        onSubmit={v => addProtocol.mutate(v)} loading={addProtocol.isPending} />
                </div>
            )}

            {/* Tab 3 — Treatment Arms */}
            {tab === 3 && (
                <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{['Arm Code', 'Description', 'Blinding'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {arms?.map((a: any) => <tr key={a.arm_id}><td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{a.arm_code}</td><td style={{ padding: '8px 10px' }}>{a.arm_description}</td><td style={{ padding: '8px 10px', color: '#6B7280' }}>{a.blinding_level}</td></tr>)}
                        </tbody>
                    </table>
                    {/* Custom add-arm row with blinding dropdown instead of free text */}
                    <ArmAddRow onSubmit={v => addArm.mutate(v)} loading={addArm.isPending} />
                </div>
            )}

            {/* Tab 4 — Eligibility */}
            {tab === 4 && (
                <div className="card">
                    {['Inclusion', 'Exclusion'].map(type => (
                        <div key={type}>
                            <h4 style={{ color: type === 'Inclusion' ? '#10B981' : '#DC2626', margin: '12px 0 6px' }}>{type} Criteria</h4>
                            {eligibility?.filter((e: any) => e.criterion_type === type).map((e: any, i: number) => (
                                <div key={e.criterion_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #F9FAFB' }}>
                                    <span style={{ color: '#9CA3AF', fontSize: 12, minWidth: 24 }}>{i + 1}.</span>
                                    <span style={{ fontSize: 13, flex: 1 }}>{e.criterion_text}</span>
                                    <button 
                                        onClick={() => adminAPI.deleteTrialEntity(trialId as string, 'eligibility', e.criterion_id).then(() => qc.invalidateQueries({ queryKey: ['admin', 'trial', trialId] }))}
                                        style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                    <InlineForm fields={[{ name: 'criterion_text', label: 'Criterion Text' }, { name: 'criterion_type', label: 'Type (Inclusion/Exclusion)' }]}
                        onSubmit={v => addElig.mutate(v)} loading={addElig.isPending} />
                </div>
            )}

            {/* Tab 5 — Visit Schedule */}
            {tab === 5 && (
                <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{['Visit', 'Day Offset', 'Window (±)'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {visits?.map((v: any) => <tr key={v.visit_id}><td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.visit_name}</td><td style={{ padding: '8px 10px' }}>Day {v.day_offset}</td><td style={{ padding: '8px 10px', color: '#6B7280' }}>-{v.visit_window_before_days}/+{v.visit_window_after_days}</td></tr>)}
                        </tbody>
                    </table>
                    <InlineForm fields={[{ name: 'visit_name', label: 'Name' }, { name: 'visit_day', label: 'Day Offset', type: 'number' }, { name: 'window_before_days', label: 'Before', type: 'number' }, { name: 'window_after_days', label: 'After', type: 'number' }]}
                        onSubmit={v => addVisit.mutate({ ...v, visit_day: Number(v.visit_day), window_before_days: Number(v.window_before_days), window_after_days: Number(v.window_after_days) })} loading={addVisit.isPending} />
                </div>
            )}

            {/* Tab 6 — eCRF Defs */}
            {tab === 6 && (
                <div className="card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        {ecrfDefs?.length === 0 ? (
                            <div className="sm-empty" style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF' }}>
                                <FileText size={28} style={{ margin: '0 auto 8px' }} />
                                <div>No eCRF definitions yet. Add one below.</div>
                            </div>
                        ) : ecrfDefs?.map((e: any) => (
                            <div key={e.ecrf_id ?? e.ecrf_definition_id} style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #F3F4F6' }}>
                                <div style={{ width: 32, height: 32, background: '#EEF2FF', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={16} color="#4F46E5" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{e.ecrf_name}</div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Version {e.version ?? '—'} &nbsp;·&nbsp; {Object.keys(e.ecrf_schema?.fields ?? {}).length} fields defined</div>
                                </div>
                                <span className="admin-badge admin-badge-blue" style={{ marginLeft: 'auto', fontSize: 10 }}>Active</span>
                            </div>
                        ))}
                    </div>
                    <InlineForm
                        fields={[
                            { name: 'ecrf_name', label: 'Form Name' },
                            { name: 'version', label: 'Version (e.g. 1.0)' },
                            { name: 'description', label: 'Short Description' },
                        ]}
                        onSubmit={v => addEcrf.mutate(v)}
                        loading={addEcrf.isPending}
                    />
                </div>
            )}

            {/* Tab 7 — Lab Tests */}
            {tab === 7 && (
                <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{['Test', 'LOINC', 'Unit', 'Reference Range', 'Critical Range'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {labTests?.map((t: any) => <tr key={t.test_id}><td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.test_name}</td><td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{t.test_code_loinc}</td><td style={{ padding: '8px 10px' }}>{t.unit_of_measure}</td><td style={{ padding: '8px 10px' }}>{t.reference_ranges?.low} – {t.reference_ranges?.high}</td><td style={{ padding: '8px 10px', color: '#DC2626' }}>{t.critical_low_value} – {t.critical_high_value}</td></tr>)}
                        </tbody>
                    </table>
                    <InlineForm fields={[{ name: 'test_name', label: 'Test Name' }, { name: 'test_code_loinc', label: 'LOINC' }, { name: 'unit_of_measure', label: 'Unit' }, { name: 'reference_low', label: 'Ref Low', type: 'number' }, { name: 'reference_high', label: 'Ref High', type: 'number' }]}
                        onSubmit={v => addLab.mutate({ ...v, reference_low: Number(v.reference_low), reference_high: Number(v.reference_high) })} loading={addLab.isPending} />
                </div>
            )}
        </div>
    );
};
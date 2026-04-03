import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Plus, X, Database, FlaskConical } from 'lucide-react';
import '../Dashboard.css';
import { dataManagerAPI } from '../../services/api';
//belongs to dataManager role

export interface TrialData {
    trial_id: number;
    trial_title: string;
}

export interface ExportCondition {
    column: string;
    operator: string;
    value: string;
}

export interface AnalysisDataset {
    dataset_id: number;
    trial_id: number;
    dataset_name: string;
    dataset_type: string;
    snapshot_date: string;
    data_cutoff_date: string;
    population_count: number | null;
    p_value: string | null;
    statistical_significance: boolean | null;
    analysis_results: Record<string, any>;
    created_at: string;
}


//Sub-tab 1: CDISC SDTM Export
const DOMAINS = [
    { key: 'DM', label: 'Demographics', desc: 'Patient baseline data' },
    { key: 'AE', label: 'Adverse Events', desc: 'All AE records' },
    { key: 'VS', label: 'Vital Signs', desc: 'BP, HR, temperature, SpO2' },
    { key: 'LB', label: 'Laboratory Results', desc: 'Lab test results' },
];

const CDISCExportTab: React.FC<{ trialId: string }> = ({ trialId }) => {
    const [selected, setSelected]   = useState<string[]>(['DM', 'AE', 'VS', 'LB']);
    const [cutoff, setCutoff]       = useState(new Date().toISOString().split('T')[0]);
    const [previewData, setPreviewData] = useState<Record<string, any[]> | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [fmt, setFmt] = useState<'csv' | 'json'>('csv');

    const preview = async () => {
        if (!trialId || !selected.length) return;
        setPreviewLoading(true);
        try {
            const res = await dataManagerAPI.generateDMSDTMExport({ 
                trial_id: parseInt(trialId), 
                domains: selected, 
                cutoff_date: cutoff 
            });
            setPreviewData(res.data);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setPreviewLoading(false); 
        }
    };

    const exportData = () => {
        if (!previewData) return;
        if (fmt === 'json') {
            const blob = new Blob([JSON.stringify(previewData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sdtm_export_trial${trialId}.json`; a.click();
        } else {
            // CSV: one file per domain
            selected.forEach(domain => {
                const rows: any[] = previewData[domain] ?? [];
                if (!rows.length) return;
                const headers = Object.keys(rows[0]).join(',');
                const csv = [headers, ...rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sdtm_${domain}_trial${trialId}.csv`; a.click();
            });
        }
    };

    return (
        <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <h3 className="card-title"><Database size={16} /> CDISC SDTM Export</h3>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Results via sp_export_cdisc_sdtm</span>
                </div>
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                            <label className="form-label">Data Cutoff Date</label>
                            <input className="form-input" type="date" value={cutoff} onChange={e => setCutoff(e.target.value)} style={{ width: 180 }} />
                        </div>
                        <div>
                            <label className="form-label">Export Format</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['csv', 'json'] as const).map(f => (
                                    <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 14px', border: `1.5px solid ${fmt === f ? '#3B82F6' : '#E5E7EB'}`, borderRadius: 8, background: fmt === f ? '#EFF6FF' : 'white', fontSize: '0.8rem', fontWeight: fmt === f ? 700 : 400 }}>
                                        <input type="radio" name="fmt" value={f} checked={fmt === f} onChange={() => setFmt(f)} style={{ display: 'none' }} />
                                        {f.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="form-label">Domains to Export</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                            {DOMAINS.map(d => {
                                const checked = selected.includes(d.key);
                                return (
                                    <label key={d.key} style={{ cursor: 'pointer', padding: '10px 12px', border: `1.5px solid ${checked ? '#3B82F6' : '#E5E7EB'}`, borderRadius: 8, background: checked ? '#EFF6FF' : 'white' }}>
                                        <input type="checkbox" checked={checked} onChange={e => setSelected(s => e.target.checked ? [...s, d.key] : s.filter(x => x !== d.key))} style={{ display: 'none' }} />
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: checked ? '#1D4ED8' : '#374151' }}>{d.key}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>{d.label}</p>
                                        <p style={{ margin: '1px 0 0', fontSize: 10, color: '#9CA3AF' }}>{d.desc}</p>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={preview} disabled={!trialId || !selected.length || previewLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Eye size={14} /> {previewLoading ? 'Loading…' : 'Preview Selected Domains'}
                        </button>
                        <button className="btn-primary" onClick={exportData} disabled={!previewData}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Download size={14} /> Export {fmt.toUpperCase()}
                        </button>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>Results generated by stored procedure: sp_export_cdisc_sdtm</p>
                </div>
            </div>

            {/* Preview tables */}
            {previewData && selected.map(domain => {
                const rows: any[] = previewData[domain] ?? [];
                const cols = rows.length ? Object.keys(rows[0]) : [];
                return (
                    <div key={domain} className="card" style={{ marginBottom: 16 }}>
                        <div className="card-header">
                            <h3 className="card-title">{domain} Domain</h3>
                            <span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{rows.length} records</span>
                        </div>
                        {rows.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>No data in {domain} domain for this trial.</div>
                        ) : (
                            <div style={{ overflowX: 'auto', maxHeight: 280 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#F9FAFB' }}>
                                        <tr>{cols.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{c}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(0, 20).map((r: any, i: number) => (
                                            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                                {cols.map(c => <td key={c} style={{ padding: '5px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{r[c] ?? '—'}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {rows.length > 20 && <p style={{ padding: '8px 12px', fontSize: 11, color: '#9CA3AF', borderTop: '1px solid #F3F4F6' }}>Showing first 20 of {rows.length} records</p>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

//Sub-tab 2: Custom Export Builder
const EXPORT_TABLES: Record<string, string[]> = {
    patients: ['patient_id','trial_patient_id','patient_status','date_of_birth','gender','enrollment_date','site_id'],
    adverse_events: ['ae_id','patient_id','ae_term','ae_start_date','ae_end_date','severity_grade','causality_relationship','treatment_related'],
    lab_results: ['result_id','patient_id','test_id','result_value','result_date','result_status','critical_result_flag'],
    vital_signs: ['vital_id','patient_id','measurement_time','systolic_bp','diastolic_bp','heart_rate','temperature','oxygen_saturation'],
    patient_visits: ['visit_instance_id','patient_id','visit_id','scheduled_date','actual_visit_date','visit_status'],
    protocol_deviations: ['deviation_id','patient_id','deviation_type','deviation_date','description','corrective_action','reported_to_irb'],
    ecrf_data: ['ecrf_instance_id','ecrf_id','patient_id','visit_instance_id','form_status','data_entry_date'],
    randomization_assignments: ['assignment_id','patient_id','arm_id','randomization_date','randomization_method'],
};
const OPERATORS = ['=','!=','>','<','>=','<=','ILIKE','IS NULL','IS NOT NULL'];

const CustomExportTab: React.FC = () => {
    const [activeTable, setActiveTable]   = useState('patients');
    const [selectedCols, setSelectedCols] = useState<string[]>([]);
    const [conditions, setConditions]     = useState<ExportCondition[]>([]);
    const [previewData, setPreviewData]   = useState<any[] | null>(null);
    const [loading, setLoading]           = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [savedTemplates, setSavedTemplates] = useState<Record<string, { columns: string[]; conditions: ExportCondition[] }>>(() => {
        try { return JSON.parse(localStorage.getItem('dm_export_templates') ?? '{}'); } catch { return {}; }
    });

    const addCol = (col: string) => { const key = `${activeTable}.${col}`; if (!selectedCols.includes(key)) setSelectedCols(s => [...s, key]); };
    const removeCol = (col: string) => setSelectedCols(s => s.filter(c => c !== col));
    const addCondition = () => setConditions(s => [...s, { column: selectedCols[0] ?? '', operator: '=', value: '' }]);
    const updateCondition = (i: number, patch: Partial<ExportCondition>) =>
        setConditions(s => s.map((c, idx) => idx === i ? { ...c, ...patch } : c));

    const saveTemplate = () => {
        if (!templateName) return;
        const t = { ...savedTemplates, [templateName]: { columns: selectedCols, conditions } };
        setSavedTemplates(t); localStorage.setItem('dm_export_templates', JSON.stringify(t));
    };
    const loadTemplate = (name: string) => {
        const t = savedTemplates[name]; if (t) { setSelectedCols(t.columns); setConditions(t.conditions); }
    };

    const doPreview = async () => {
        setLoading(true);
        try {
            const res = await dataManagerAPI.generateCustomExport({ columns: selectedCols, conditions, preview: true });
            setPreviewData(res.data);
        } catch (e: any) { 
            alert(e.response?.data?.error ?? e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    const exportCsv = async () => {
        try {
            const res = await dataManagerAPI.generateCustomExport({ columns: selectedCols, conditions, preview: false });
            const rows: any[] = res.data;
            if (!rows.length) return;
            const headers = Object.keys(rows[0]).join(',');
            const csv = [headers, ...rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(','))].join('\n');
            const b = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'custom_export.csv'; a.click();
        } catch (e: any) {
            alert(e.response?.data?.error ?? e.message);
        }
    };

    const previewCols = previewData?.length ? Object.keys(previewData[0]) : [];

    return (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            {/* Left: available tables */}
            <div style={{ width: 220, flexShrink: 0 }}>
                <div className="card">
                    <div className="card-header"><h3 className="card-title" style={{ fontSize: '0.875rem' }}>Available Tables</h3></div>
                    <div style={{ padding: '0.5rem' }}>
                        {Object.keys(EXPORT_TABLES).map(tbl => (
                            <div key={tbl}>
                                <button onClick={() => setActiveTable(tbl)}
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: activeTable === tbl ? '#EFF6FF' : 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: activeTable === tbl ? 700 : 400, fontSize: '0.8rem', color: activeTable === tbl ? '#1D4ED8' : '#374151', marginBottom: 2 }}>
                                    {tbl}
                                </button>
                                {activeTable === tbl && (
                                    <div style={{ paddingLeft: 12, paddingBottom: 8 }}>
                                        {EXPORT_TABLES[tbl].map(col => (
                                            <button key={col} onClick={() => addCol(col)}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6B7280', borderRadius: 4 }}>
                                                + {col}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: builder */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Selected columns */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ fontSize: '0.875rem' }}>Selected Columns ({selectedCols.length})</h3>
                        <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setSelectedCols([])}>Clear All</button>
                    </div>
                    <div style={{ padding: '0.875rem 1.25rem', minHeight: 60, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {selectedCols.length === 0 ? <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Click columns from the left panel to add them here…</span> :
                            selectedCols.map(col => (
                                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '4px 10px' }}>
                                    <code style={{ fontSize: 11, color: '#1D4ED8' }}>{col}</code>
                                    <button onClick={() => removeCol(col)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex' }}><X size={12} /></button>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* Filter conditions */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ fontSize: '0.875rem' }}>Filter Conditions (AND)</h3>
                        <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={addCondition}><Plus size={12} /> Add Condition</button>
                    </div>
                    <div style={{ padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {conditions.length === 0 ? <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>No conditions — all rows will be returned.</span> :
                            conditions.map((cond, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select className="form-select" style={{ flex: 2, fontSize: 12 }} value={cond.column} onChange={e => updateCondition(i, { column: e.target.value })}>
                                        {selectedCols.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                    <select className="form-select" style={{ flex: 1, fontSize: 12 }} value={cond.operator} onChange={e => updateCondition(i, { operator: e.target.value })}>
                                        {OPERATORS.map(op => <option key={op}>{op}</option>)}
                                    </select>
                                    {!['IS NULL','IS NOT NULL'].includes(cond.operator) && (
                                        <input className="form-input" style={{ flex: 2, fontSize: 12 }} value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })} placeholder="Value…" />
                                    )}
                                    <button onClick={() => setConditions(s => s.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={14} /></button>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* Templates + actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="form-input" style={{ width: 180, fontSize: 13 }} value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name…" />
                    <button className="btn-secondary" style={{ fontSize: 13 }} onClick={saveTemplate} disabled={!templateName}>Save Template</button>
                    {Object.keys(savedTemplates).length > 0 && (
                        <select className="form-select" style={{ width: 200, fontSize: 13 }} onChange={e => loadTemplate(e.target.value)}>
                            <option value="">Load Template…</option>
                            {Object.keys(savedTemplates).map(n => <option key={n}>{n}</option>)}
                        </select>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={doPreview} disabled={!selectedCols.length || loading} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <Eye size={13} /> {loading ? 'Loading…' : 'Preview (50 rows)'}
                        </button>
                        <button className="btn-primary" onClick={exportCsv} disabled={!selectedCols.length} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <Download size={13} /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Preview */}
                {previewData && (
                    <div className="card">
                        <div className="card-header"><h3 className="card-title" style={{ fontSize: '0.875rem' }}>Preview</h3><span style={{ fontSize: 11, color: '#9CA3AF' }}>{previewData.length} rows</span></div>
                        <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#F9FAFB' }}>
                                    <tr>{previewCols.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {previewData.map((r: any, i: number) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                            {previewCols.map(c => <td key={c} style={{ padding: '5px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{r[c] ?? '—'}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

//Sub-tab 3: Analysis Datasets
const AnalysisDatasetsTab: React.FC<{ trialId: string }> = ({ trialId }) => {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [viewDataset, setViewDataset] = useState<AnalysisDataset | null>(null);
    const [form, setForm] = useState({ dataset_name: '', dataset_type: 'Safety', data_cutoff_date: new Date().toISOString().split('T')[0], population_definition: '' });
    const [msg, setMsg] = useState('');

    const { data: datasets = [], isLoading } = useQuery<AnalysisDataset[]>({
        queryKey: ['datasets', trialId],
        queryFn: () => dataManagerAPI.getDatasets(trialId),
        enabled: !!trialId,
    });

    const createMut = useMutation({
        mutationFn: () => dataManagerAPI.createDataset({ ...form, trial_id: parseInt(trialId) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['datasets', trialId] }); setShowCreate(false); setMsg(''); },
        onError: (e: any) => setMsg(e.response?.data?.error ?? e.message),
    });

    const renderResults = (results: any) => {
        if (!results) return null;
        const sections = [
            { key: 'patient_accountability', title: 'Patient Accountability' },
            { key: 'data_completeness', title: 'Data Completeness' },
            { key: 'query_status', title: 'Query Status' },
            { key: 'protocol_deviations', title: 'Protocol Deviations' },
        ];
        return sections.map(({ key, title }) => results[key] ? (
            <div key={key} style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>{title}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(results[key]).map(([k, v]) => (
                        <div key={k} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                            <span style={{ color: '#9CA3AF', textTransform: 'capitalize' }}>{k.replace(/_/g,' ')}:</span>{' '}
                            <strong style={{ color: '#111827' }}>{String(v)}</strong>
                        </div>
                    ))}
                </div>
            </div>
        ) : null);
    };

    if (!trialId) return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Select a trial above.</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> Create New Dataset
                </button>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><FlaskConical size={16} /> Analysis Datasets</h3>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Generated by sp_generate_csdr</span>
                </div>
                {isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>Loading datasets…</div>
                ) : datasets.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                        <FlaskConical size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
                        <p style={{ margin: 0 }}>No analysis datasets yet — create one above.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB' }}>
                                    {['Name', 'Type', 'Snapshot Date', 'Cutoff', 'Population', 'P-Value', 'Significant', 'Created', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {datasets.map((d, i) => (
                                    <tr key={d.dataset_id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.dataset_name}</td>
                                        <td style={{ padding: '10px 12px' }}><span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{d.dataset_type}</span></td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{d.snapshot_date?.split('T')[0]}</td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280' }}>{d.data_cutoff_date?.split('T')[0]}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.population_count ?? '—'}</td>
                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{d.p_value ?? '—'}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            {d.statistical_significance === null ? '—'
                                                : d.statistical_significance
                                                    ? <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Yes</span>
                                                    : <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>No</span>}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setViewDataset(d)}>View</button>
                                                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 3 }}
                                                    onClick={() => { const b = new Blob([JSON.stringify(d.analysis_results, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `dataset_${d.dataset_id}.json`; a.click(); }}>
                                                    <Download size={10} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create dialog */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontWeight: 700 }}>Create Analysis Dataset</h3>
                            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div><label className="form-label">Dataset Name</label><input className="form-input" value={form.dataset_name} onChange={e => setForm(f => ({ ...f, dataset_name: e.target.value }))} /></div>
                            <div><label className="form-label">Type</label>
                                <select className="form-select" value={form.dataset_type} onChange={e => setForm(f => ({ ...f, dataset_type: e.target.value }))}>
                                    {['Safety','Efficacy','ITT','Per Protocol','Exploratory'].map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div><label className="form-label">Data Cutoff Date</label><input className="form-input" type="date" value={form.data_cutoff_date} onChange={e => setForm(f => ({ ...f, data_cutoff_date: e.target.value }))} /></div>
                            <div><label className="form-label">Population Definition</label><textarea className="form-input" rows={2} value={form.population_definition} onChange={e => setForm(f => ({ ...f, population_definition: e.target.value }))} placeholder="Describe inclusion criteria…" /></div>
                        </div>
                        {msg && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 8 }}>{msg}</p>}
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>This calls stored procedure: sp_generate_csdr</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="btn-primary" disabled={!form.dataset_name || createMut.isPending} onClick={() => createMut.mutate()}>
                                {createMut.isPending ? 'Generating…' : 'Generate Dataset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View results */}
            {viewDataset && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: 600, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontWeight: 700 }}>{viewDataset.dataset_name}</h3>
                            <button onClick={() => setViewDataset(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        {renderResults(viewDataset.analysis_results)}
                        <p style={{ fontSize: 11, color: '#9CA3AF', borderTop: '1px solid #F3F4F6', paddingTop: 8, marginTop: 8 }}>Results generated by stored procedure: sp_generate_csdr</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main CDISCExport (DataExport) Page ─────────────────────────────────────────
const SUB_TABS = ['CDISC SDTM Export', 'Custom Export Builder', 'Analysis Datasets'] as const;

export const CDISCExport: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('CDISC SDTM Export');
    const [trialId, setTrialId]     = useState('');
    const { data: trials = [] } = useQuery<TrialData[]>({ 
        queryKey: ['dm-trials'], 
        queryFn: () => dataManagerAPI.getTrials() 
    });

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Data Export</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>CDISC SDTM, custom exports, and analysis datasets</p>
                </div>
                {activeTab !== 'Custom Export Builder' && (
                    <div style={{ minWidth: 240 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Trial</label>
                        <select className="form-select" value={trialId} onChange={e => setTrialId(e.target.value)}>
                            <option value="">Select trial…</option>
                            {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Sub-tab bar */}
            <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB', marginBottom: '1.5rem' }}>
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

            {activeTab === 'CDISC SDTM Export'      && <CDISCExportTab trialId={trialId} />}
            {activeTab === 'Custom Export Builder'   && <CustomExportTab />}
            {activeTab === 'Analysis Datasets'       && <AnalysisDatasetsTab trialId={trialId} />}
        </div>
    );
};
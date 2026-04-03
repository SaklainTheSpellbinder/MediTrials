import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Database, Plus, X, Eye, FileJson } from 'lucide-react';
import '../statistician-pages.css';
import { statisticsAPI } from '../../services/api';
//page of statistician
export interface TrialData {
    trial_id: string;
    trial_title: string;
}

export interface AnalysisDataset {
    dataset_id: number;
    dataset_name: string;
    dataset_type: string;
    snapshot_date?: string;
    data_cutoff_date?: string;
    population_count?: number;
    p_value?: number | string | null;
    statistical_significance?: boolean | null;
    created_at: string;
    analysis_results?: Record<string, any>;
}

export interface AuditLogEntry {
    username: string;
    change_reason: string;
    change_timestamp: string;
}


const datasetTypes = ['Safety', 'Efficacy', 'ITT', 'Per Protocol', 'Exploratory'];

export const AnalysisDatasets: React.FC = () => {
    const { user } = useAuth();
    const qc = useQueryClient();

    const [trialId, setTrialId] = useState<string>('');
    const [showCreate, setShowCreate] = useState(false);
    const [selectedDataset, setSelectedDataset] = useState<AnalysisDataset | null>(null);

    const [form, setForm] = useState({
        dataset_name: '',
        dataset_type: 'Safety',
        data_cutoff_date: new Date().toISOString().split('T')[0],
        population_definition: '',
        p_value: '',
        statistical_significance: false
    });
    const [msg, setMsg] = useState('');

    // Fetch Trials
    const { data: trials = [] } = useQuery<TrialData[]>({
        queryKey: ['stat-trials'],
        queryFn: () => statisticsAPI.getTrials()
    });

    // Fetch Datasets
    const { data: datasets = [], isLoading } = useQuery<AnalysisDataset[]>({
        queryKey: ['stat-datasets', trialId],
        queryFn: () => statisticsAPI.getDatasets(trialId)
    });

    // Fetch Audit (when dataset selected)
    const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
        queryKey: ['stat-dataset-audit', selectedDataset?.dataset_id],
        queryFn: () => statisticsAPI.getDatasetAudit(selectedDataset!.dataset_id),
        enabled: !!selectedDataset
    });

    const createMut = useMutation({
        mutationFn: () => statisticsAPI.createDataset({
            trial_id: parseInt(form.dataset_name ? (trialId || trials[0]?.trial_id) : trialId),
            ...form,
            p_value: form.p_value ? parseFloat(form.p_value) : null,
            statistical_significance: form.p_value ? form.statistical_significance : null
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['stat-datasets'] });
            setShowCreate(false);
            setMsg('');
            setForm({ ...form, dataset_name: '', p_value: '', statistical_significance: false });
        },
        onError: (e: any) => setMsg(e.response?.data?.error ?? e.message)
    });

    // Sub-components
    const DatasetDetailPanel = () => {
        if (!selectedDataset) return null;
        const d = selectedDataset;
        const res = d.analysis_results || {};

        return (
            <div className="stat-side-panel" style={{ right: selectedDataset ? 0 : -520, transition: 'right 0.3s ease' }}>
                <div className="stat-panel-header">
                    <div>
                        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem' }}>{d.dataset_name}</h3>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <span className={`sig-badge-sig ds-badge-${d.dataset_type.replace(' ', '')}`}>{d.dataset_type}</span>
                            <span className="sig-badge-not">n = {d.population_count}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedDataset(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={20} /></button>
                </div>
                
                <div className="stat-panel-body">
                    {/* Results sections */}
                    {['patient_accountability', 'data_completeness', 'query_status', 'protocol_deviations'].map(key => {
                        const sectionData = res[key];
                        if (!sectionData) return null;
                        
                        return (
                            <div key={key} className="stat-panel-section">
                                <div className="stat-panel-section-header">{key.replace('_', ' ')}</div>
                                <div className="stat-panel-section-body stat-result-grid">
                                    {Object.entries(sectionData).map(([k, v]) => (
                                        <div key={k} className="stat-result-item">
                                            <div className="stat-result-key">{k.replace(/_/g, ' ')}</div>
                                            <div className="stat-result-val">{String(v)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Statistical Summary */}
                    {d.p_value !== null && d.p_value !== undefined && (
                        <div className="stat-panel-section">
                            <div className="stat-panel-section-header">Statistical Summary</div>
                            <div className="stat-panel-section-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
                                <div className={`pval-large ${Number(d.p_value) < 0.05 ? 'pval-sig' : 'pval-notsig'}`}>
                                    p = {parseFloat(String(d.p_value)).toFixed(4)}
                                </div>
                                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: d.statistical_significance ? '#065F46' : '#6B7280' }}>
                                    {d.statistical_significance ? 'The result IS statistically significant at α = 0.05' : 'The result is NOT statistically significant'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Downloads */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button className="btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }} 
                            onClick={() => {
                                const b = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' }); 
                                const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `dataset_${d.dataset_id}.json`; a.click(); 
                            }}>
                            <FileJson size={14} /> Download JSON
                        </button>
                    </div>

                    {/* Audit Mini Log */}
                    {auditLog.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div className="stat-panel-section-header" style={{ background: 'transparent', padding: '0 0 8px 0' }}>Recent Audit Activity</div>
                            {auditLog.map((log, i) => (
                                <div key={i} className="audit-mini-item">
                                    <div className="audit-mini-dot" />
                                    <div>
                                        <div className="audit-mini-action"><strong>{log.username}</strong> — {log.change_reason}</div>
                                        <div className="audit-mini-meta">{new Date(log.change_timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const CreateModal = () => {
        if (!showCreate) return null;
        return (
            <div className="stat-modal-overlay">
                <div className="stat-modal-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ margin: 0, fontWeight: 700 }}>Create Analysis Dataset</h3>
                        <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label className="form-label">Trial</label>
                            <select className="form-input" value={trialId} onChange={e => setTrialId(e.target.value)}>
                                <option value="">Select trial...</option>
                                {trials.map(t => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Dataset Name</label>
                            <input className="form-input" value={form.dataset_name} onChange={e => setForm(f => ({ ...f, dataset_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Type</label>
                            <select className="form-input" value={form.dataset_type} onChange={e => setForm(f => ({ ...f, dataset_type: e.target.value }))}>
                                {datasetTypes.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Data Cutoff Date</label>
                            <input type="date" className="form-input" value={form.data_cutoff_date} onChange={e => setForm(f => ({ ...f, data_cutoff_date: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Population Definition</label>
                            <textarea className="form-input" rows={2} value={form.population_definition} onChange={e => setForm(f => ({ ...f, population_definition: e.target.value }))} placeholder="E.g., All randomized patients who received at least one dose..." />
                        </div>
                        
                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14, marginTop: 4 }}>
                            <label className="form-label" style={{ color: '#6B7280' }}>Post-Analysis Results (Optional)</label>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <input type="number" step="0.0001" className="form-input" placeholder="P-value..." value={form.p_value} onChange={e => setForm(f => ({ ...f, p_value: e.target.value }))} />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: form.p_value ? '#374151' : '#9CA3AF', cursor: form.p_value ? 'pointer' : 'default' }}>
                                    <input type="checkbox" disabled={!form.p_value} checked={form.statistical_significance} onChange={e => setForm(f => ({ ...f, statistical_significance: e.target.checked }))} />
                                    Statistically Significant
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    {msg && <p style={{ color: '#DC2626', fontSize: '0.875rem', marginTop: 12 }}>{msg}</p>}
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                        <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button className="btn-primary" disabled={!form.dataset_name || (!trialId && !trials.length) || createMut.isPending} onClick={() => createMut.mutate()}>
                            {createMut.isPending ? 'Generating...' : 'Generate Dataset'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (user?.role !== 'Statistician') {
        return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Access Denied. Statistician role required.</div>;
    }

    return (
        <div className="dashboard-container" style={{ position: 'relative', overflowX: 'hidden' }}>
            {/* Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Analysis Datasets</h1>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>View, explore, and download generated analysis datasets.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={16} /> Create New Dataset
                </button>
            </div>

            {/* Controls */}
            <div className="stat-controls-bar">
                <div style={{ minWidth: 260 }}>
                    <label>Trial Filter</label>
                    <select value={trialId} onChange={e => setTrialId(e.target.value)} style={{ width: '100%' }}>
                        <option value="">All Trials</option>
                        {trials.map(t => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Table */}
            <div className="card">
                {isLoading ? (
                    <div style={{ padding: '3rem 2rem' }}>
                        {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row" />)}
                    </div>
                ) : datasets.length === 0 ? (
                    <div className="stat-empty-state">
                        <Database size={48} />
                        <div className="stat-empty-title">No datasets yet</div>
                        <p className="stat-empty-sub">Create one to begin analysis</p>
                    </div>
                ) : (
                    <div className="stat-table-container">
                        <table className="stat-data-table">
                            <thead>
                                <tr>
                                    <th>Dataset Name</th>
                                    <th>Type</th>
                                    <th>Snapshot Date</th>
                                    <th>Cutoff Date</th>
                                    <th>Pop. Count</th>
                                    <th>P-Value</th>
                                    <th>Significance</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datasets.map((d) => (
                                    <tr key={d.dataset_id} 
                                        onClick={() => setSelectedDataset(d)}
                                        className={selectedDataset?.dataset_id === d.dataset_id ? 'selected' : ''}>
                                        <td style={{ fontWeight: 600 }}>{d.dataset_name}</td>
                                        <td><span className={`sig-badge-sig ds-badge-${d.dataset_type.replace(' ', '')}`}>{d.dataset_type}</span></td>
                                        <td>{d.snapshot_date ? d.snapshot_date.split('T')[0] : '—'}</td>
                                        <td>{d.data_cutoff_date ? d.data_cutoff_date.split('T')[0] : '—'}</td>
                                        <td>{d.population_count?.toLocaleString() || '—'}</td>
                                        <td style={{ fontFamily: 'monospace' }}>
                                            {d.p_value !== null && d.p_value !== undefined ? (Number(d.p_value) < 0.001 ? '< 0.001' : parseFloat(String(d.p_value)).toFixed(4)) : <span style={{ color: '#9CA3AF' }}>Pending</span>}
                                        </td>
                                        <td>
                                            {d.statistical_significance === null || d.statistical_significance === undefined ? <span className="sig-badge-pending">Pending</span> : 
                                             d.statistical_significance ? <span className="sig-badge-sig">Significant</span> : 
                                             <span className="sig-badge-not">Not Significant</span>}
                                        </td>
                                        <td style={{ color: '#6B7280', fontSize: 11 }}>{new Date(d.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setSelectedDataset(d)}>
                                                    <Eye size={12} /> View
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

            <DatasetDetailPanel />
            <CreateModal />
            
            {/* Backdrop for side panel */}
            {selectedDataset && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 1099 }} onClick={() => setSelectedDataset(null)} />
            )}
        </div>
    );
};
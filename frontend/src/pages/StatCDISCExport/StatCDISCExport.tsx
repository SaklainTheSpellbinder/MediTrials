import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Eye, Database, BriefcaseMedical } from 'lucide-react';
import '../statistician-pages.css';
import { statisticsAPI } from '../../services/api';

// --- Type Interfaces ---
export interface TrialData {
    trial_id: string;
    trial_title: string;
}

export interface ExportCounts {
    dm_count: string | number;
    ae_count: string | number;
    vs_count: string | number;
    lb_count: string | number;
}
// ------------------------

const DOMAINS = [
    { key: 'DM', label: 'Demographics', desc: 'Patient baseline data' },
    { key: 'AE', label: 'Adverse Events', desc: 'All AE records (Augmented)' },
    { key: 'VS', label: 'Vital Signs', desc: 'BP, HR, temperature, SpO2' },
    { key: 'LB', label: 'Laboratory Results', desc: 'Lab results (Augmented)' },
];

export const StatCDISCExport: React.FC = () => {
    const { user } = useAuth();
    const [trialId, setTrialId] = useState<string>('');
    const [selected, setSelected] = useState<string[]>(['DM', 'AE', 'VS', 'LB']);
    const [previewData, setPreviewData] = useState<Record<string, any[]> | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [fmt, setFmt] = useState<'csv' | 'json'>('csv');

    const { data: trials = [] } = useQuery<TrialData[]>({ 
        queryKey: ['stat-trials'], 
        queryFn: () => statisticsAPI.getTrials() 
    });
    
    // Domain record counts pre-fetch preview
    const { data: counts } = useQuery<ExportCounts>({
        queryKey: ['stat-export-counts', trialId],
        queryFn: () => statisticsAPI.getExportCounts(trialId),
        enabled: !!trialId
    });

    const preview = async () => {
        if (!trialId || !selected.length) return;
        setPreviewLoading(true);
        try {
            // Hitting the statistician-specific export endpoint which includes statistical augmentations
            const res = await statisticsAPI.generateSDTMExport({ 
                trial_id: parseInt(trialId), 
                domains: selected 
            });
            setPreviewData(res.data);
        } catch (e) {
            console.error(e);
            alert("Failed to generate CDISC export.");
        } finally {
            setPreviewLoading(false);
        }
    };

    const exportData = () => {
        if (!previewData) return;
        if (fmt === 'json') {
            const blob = new Blob([JSON.stringify(previewData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sdtm_export_stat_trial${trialId}.json`; a.click();
        } else {
            selected.forEach(domain => {
                const rows: any[] = previewData[domain] ?? [];
                if (!rows.length) return;
                const headers = Object.keys(rows[0]).join(',');
                const csv = [headers, ...rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sdtm_${domain}_stat_trial${trialId}.csv`; a.click();
            });
        }
    };

    if (user?.role !== 'Statistician') return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>Access Denied.</div>;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">CDISC SDTM Dataset Export</h1>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>Statistically augmented SDTM exports for analysis programming and submission preparation.</p>
                </div>
                <div style={{ minWidth: 260 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Trial Selector</label>
                    <select className="form-input" style={{ width: '100%' }} value={trialId} onChange={e => { setTrialId(e.target.value); setPreviewData(null); }}>
                        <option value="">Select trial...</option>
                        {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                    </select>
                </div>
            </div>

            <div className="stat-split-layout stat-split-50-50">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Database size={16} /> Domain Selection</h3>
                    </div>
                    <div className="card-body">
                        {counts && (
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20, padding: '12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Total Patients</div>
                                    <div style={{ fontSize: 16, fontWeight: 800 }}>{counts.dm_count}</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Total AEs</div>
                                    <div style={{ fontSize: 16, fontWeight: 800 }}>{counts.ae_count}</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>Lab Results</div>
                                    <div style={{ fontSize: 16, fontWeight: 800 }}>{counts.lb_count}</div>
                                </div>
                            </div>
                        )}

                        <label className="form-label">Select domains to include</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                            {DOMAINS.map(d => {
                                const checked = selected.includes(d.key);
                                return (
                                    <label key={d.key} style={{ cursor: 'pointer', padding: '12px 14px', border: `1.5px solid ${checked ? '#3B82F6' : '#E5E7EB'}`, borderRadius: 8, background: checked ? '#EFF6FF' : 'white', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <input type="checkbox" checked={checked} onChange={e => setSelected(s => e.target.checked ? [...s, d.key] : s.filter(x => x !== d.key))} style={{ marginTop: 4 }} />
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: checked ? '#1D4ED8' : '#374151' }}>{d.key} — {d.label}</div>
                                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{d.desc}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <label className="form-label" style={{ marginBottom: 4, display: 'block' }}>Export Format</label>
                                <div className="radio-group" style={{ gap: 4 }}>
                                    {(['csv', 'json'] as const).map(f => (
                                        <label key={f} className={`radio-option ${fmt === f ? 'selected' : ''}`} style={{ padding: '4px 12px' }}>
                                            <input type="radio" value={f} checked={fmt === f} onChange={() => setFmt(f)} style={{ display: 'none' }} />
                                            {f.toUpperCase()}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-secondary" onClick={preview} disabled={!trialId || !selected.length || previewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Eye size={14} /> {previewLoading ? 'Building...' : `Preview`}
                                </button>
                                <button className="btn-primary" onClick={exportData} disabled={!previewData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Download size={14} /> Export Files
                                </button>
                            </div>
                        </div>
                        
                        <div className="proc-caption" style={{ marginTop: 20 }}>Uses sp_export_cdisc_sdtm with statistical derivates appended downstream.</div>
                    </div>
                </div>

                <div className="card" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', height: '100%' }}>
                    <div className="card-header" style={{ borderBottom: '1px solid #E2E8F0', padding: '16px 20px' }}>
                        <h3 className="card-title" style={{ fontSize: 13, color: '#1E293B' }}><BriefcaseMedical size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} /> Statistician Augmentations Active</h3>
                    </div>
                    <div className="card-body" style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <li><strong>AE Domain:</strong> Added derived <code style={{ color: '#0F172A', background: '#E2E8F0', padding: '2px 4px', borderRadius: 4, fontSize: 11 }}>AEGRPID</code> (Patient grouping count) and <code style={{ color: '#0F172A', background: '#E2E8F0', padding: '2px 4px', borderRadius: 4, fontSize: 11 }}>AEOUT</code> (Resolution state).</li>
                            <li><strong>LB Domain:</strong> Added auto-calculated <code style={{ color: '#0F172A', background: '#E2E8F0', padding: '2px 4px', borderRadius: 4, fontSize: 11 }}>LBNRIND</code> (Normalcy flag High vs Normal) and <code style={{ color: '#0F172A', background: '#E2E8F0', padding: '2px 4px', borderRadius: 4, fontSize: 11 }}>LBSTRESN</code> (Standard numeric form).</li>
                            <li><strong>Direct pipeline to SAS/R:</strong> Formats conform to analytical ADaM dataset prerequisites immediately post-export.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            {previewData && selected.map(domain => {
                const rows: any[] = previewData[domain] ?? [];
                if (!rows.length) return null;
                const cols = Object.keys(rows[0]);
                return (
                    <div key={domain} className="card" style={{ marginTop: 20 }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title">{domain} Preview</h3>
                            <span className="sig-badge-sig" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{rows.length} records</span>
                        </div>
                        <div className="stat-table-container" style={{ maxHeight: 350, border: 'none' }}>
                            <table className="stat-data-table">
                                <thead>
                                    <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, 30).map((r: any, i: number) => (
                                        <tr key={i}>
                                            {cols.map(c => <td key={c}>{r[c] ?? '—'}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {rows.length > 30 && <div style={{ padding: '8px 12px', fontSize: 11, color: '#9CA3AF', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>Preview limits display to first 30 records.</div>}
                    </div>
                );
            })}
        </div>
    );
};
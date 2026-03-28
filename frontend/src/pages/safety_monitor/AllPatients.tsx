import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SeverityBadge } from '../../components/safety/SeverityBadge';
import { Search, Download, AlertTriangle, Users } from 'lucide-react';
import '../Dashboard.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

export const AllPatients: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [siteId, setSiteId] = useState('');
    const [hasAlerts, setHasAlerts] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);

    const { data: sites } = useQuery({
        queryKey: ['safety-sites'],
        queryFn: () => safetyApi.get('/api/safety/sites').then(r => r.data),
    });

    const { data: patients = [], isLoading } = useQuery({
        queryKey: ['sm-patients', search, status, siteId, hasAlerts, dateFrom, dateTo, page],
        queryFn: () => safetyApi.get('/api/safety/patients', {
            params: {
                search: search || undefined, status: status || undefined,
                site_id: siteId || undefined, has_alerts: hasAlerts || undefined,
                date_from: dateFrom || undefined, date_to: dateTo || undefined, page, limit: 50
            }
        }).then(r => r.data),
    });

    const handleExport = () => {
        const csv = ['Patient ID,Site,Age,Gender,Status,Enrollment Date,Active Alerts,Last Visit',
            ...patients.map((p: any) =>
                `${p.trial_patient_id},${p.institution_name},${p.age ?? ''},${p.gender ?? ''},${p.patient_status},${p.enrollment_date?.split('T')[0] ?? ''},${p.active_alert_count ?? 0},${p.last_visit_date?.split('T')[0] ?? ''}`
            )].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'patients.csv'; a.click();
    };

    const statusColors: Record<string, string> = {
        'Active': '#10B981', 'Completed': '#6B7280', 'Withdrawn': '#F59E0B',
        'Screen Failed': '#DC2626', 'Enrolled': '#2563EB',
    };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={22} /> All Patients
                    </h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                        Cross-site read-only registry · Safety Monitor view
                    </p>
                </div>
                <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={15} /> Export CSV
                </button>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label className="form-label">Search Patient ID</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                            <input className="form-input" style={{ paddingLeft: 28 }}
                                placeholder="PT-2024-001" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="form-label">Site</label>
                        <select className="form-select" value={siteId} onChange={e => setSiteId(e.target.value)}>
                            <option value="">All Sites</option>
                            {(sites ?? []).map((s: any) => <option key={s.site_id} value={s.site_id}>{s.institution_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Status</label>
                        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            {['Active', 'Enrolled', 'Completed', 'Withdrawn', 'Screen Failed'].map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Enrolled From</label>
                        <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Enrolled To</label>
                        <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                        <input type="checkbox" id="hasAlerts" checked={hasAlerts} onChange={e => setHasAlerts(e.target.checked)} style={{ width: 16, height: 16 }} />
                        <label htmlFor="hasAlerts" className="form-label" style={{ margin: 0 }}>Has Active Alerts</label>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {isLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading patients…</div>
                ) : patients.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                        <Users size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <p>No patients found matching current filters.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="sm-table">
                            <thead>
                                <tr>
                                    <th>Patient ID</th>
                                    <th>Site</th>
                                    <th>Age</th>
                                    <th>Gender</th>
                                    <th>Status</th>
                                    <th>Enrolled</th>
                                    <th>Arm</th>
                                    <th>Active Alerts</th>
                                    <th>Last Visit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((p: any) => (
                                    <tr key={p.patient_id}
                                        onClick={() => navigate(`/patients/${p.patient_id}`)}
                                        style={{ cursor: 'pointer' }}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>
                                            {p.trial_patient_id}
                                        </td>
                                        <td style={{ fontSize: '0.8rem' }}>{p.institution_name}</td>
                                        <td>{p.age ?? '—'}</td>
                                        <td>{p.gender ?? '—'}</td>
                                        <td>
                                            <span style={{
                                                background: '#F3F4F6', color: statusColors[p.patient_status] ?? '#6B7280',
                                                padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600,
                                            }}>{p.patient_status}</span>
                                        </td>
                                        <td style={{ fontSize: '0.8rem' }}>{p.enrollment_date?.split('T')[0] ?? '—'}</td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                            {p.arm_code ?? <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                        </td>
                                        <td>
                                            {parseInt(p.active_alert_count) > 0 ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <SeverityBadge level={p.max_alert_severity ?? 'INFO'} />
                                                    <span style={{ fontWeight: 700, color: p.max_alert_severity === 'CRITICAL' ? '#DC2626' : 'inherit' }}>
                                                        {p.active_alert_count}
                                                    </span>
                                                </span>
                                            ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                        </td>
                                        <td style={{ fontSize: '0.8rem' }}>{p.last_visit_date?.split('T')[0] ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Pagination */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--gray-500)', fontSize: '0.875rem' }}>Page {page}</span>
                    <button className="btn-secondary" disabled={patients.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            </div>
        </div>
    );
};

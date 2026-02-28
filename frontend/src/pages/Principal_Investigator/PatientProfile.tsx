import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Activity,
    FileText,
    Clock,
    Clipboard,
    Calendar,
    AlertCircle,
    PenTool,
    AlertTriangle,
    User,
    Heart,
    MapPin,
    CheckCircle,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import { patientProfileAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './PatientProfile.css';

export const PatientProfile: React.FC = () => {
    const { user } = useAuth();
    const { patient_id } = useParams<{ patient_id: string }>();
    const [activeTab, setActiveTab] = useState('timeline');
    const [patient, setPatient] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [clinical, setClinical] = useState<any>({ visits: [], vitals: [], history: [] });
    const [safety, setSafety] = useState<any>({ adverseEvents: [], alerts: [], protocolDeviations: [] });
    const [labs, setLabs] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any>({ consent: [], ecrfs: [], auditTrail: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (patient_id) fetchPatientData();
    }, [patient_id]);

    const fetchPatientData = async () => {
        try {
            setLoading(true);
            if (!patient_id) return;
            const pid = parseInt(patient_id);

            try {
                const headerData = await patientProfileAPI.getHeader(pid);
                setPatient(headerData.profile || null);
            } catch { /* will show loading state */ }

            try {
                const timelineData = await patientProfileAPI.getTimeline(pid);
                if (timelineData.timeline) setTimeline(timelineData.timeline);
            } catch { /* quietly fail */ }

            try {
                const clinicalData = await patientProfileAPI.getClinical(pid);
                if (clinicalData.clinical) setClinical(clinicalData.clinical);
            } catch { /* quietly fail */ }

            try {
                const safetyData = await patientProfileAPI.getSafety(pid);
                if (safetyData.safety) setSafety(safetyData.safety);
            } catch { /* quietly fail */ }

            try {
                const labsData = await patientProfileAPI.getLabs(pid);
                if (labsData.labs) setLabs(labsData.labs);
            } catch { /* quietly fail */ }

            try {
                const docsData = await patientProfileAPI.getDocuments(pid);
                if (docsData.documents) setDocuments(docsData.documents);
            } catch { /* quietly fail */ }

        } catch (error) {
            console.error('Error fetching patient data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateAge = (dob: string) => {
        try {
            const d = new Date(dob); const t = new Date();
            let age = t.getFullYear() - d.getFullYear();
            const m = t.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
            return age;
        } catch { return '—'; }
    };

    const formatDate = (ds: string) => {
        if (!ds) return '—';
        try { return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch { return ds; }
    };

    const getInitials = (name: string) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

    const getStatusBadgeClass = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'badge-status badge-success';
            case 'completed': return 'badge-status badge-primary';
            case 'withdrawn': return 'badge-status badge-danger';
            case 'screening': return 'badge-status badge-warning';
            default: return 'badge-status badge-gray';
        }
    };

    const getTimelineAccent = (type: string) => {
        switch (type) {
            case 'Adverse Event': return { card: 'tl-danger', dot: 'dot-danger', badge: 'tl-type-ae' };
            case 'Critical Lab': return { card: 'tl-danger', dot: 'dot-danger', badge: 'tl-type-lab' };
            case 'Visit': return { card: 'tl-primary', dot: '', badge: 'tl-type-visit' };
            case 'Enrollment': return { card: 'tl-success', dot: 'dot-success', badge: 'tl-type-enrollment' };
            default: return { card: 'tl-primary', dot: '', badge: 'tl-type-visit' };
        }
    };

    const getFlagChipClass = (flag: string, critical: string) => {
        if (critical === 'Y') return 'flag-chip flag-critical';
        switch (flag) {
            case 'High': return 'flag-chip flag-high';
            case 'Low': return 'flag-chip flag-low';
            default: return 'flag-chip flag-normal';
        }
    };

    // ── LOADING STATE ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="profile-container">
                <div className="patient-header">
                    <div className="ph-main">
                        <div className="ph-avatar skeleton" style={{ background: 'rgba(255,255,255,0.2)' }} />
                        <div className="ph-info">
                            <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 8, borderRadius: 4 }} />
                            <div className="skeleton" style={{ height: 18, width: 320, borderRadius: 4 }} />
                        </div>
                    </div>
                </div>
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
                    <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }} />
                    <p>Loading patient data…</p>
                </div>
            </div>
        );
    }

    const patientName = patient?.full_name || patient?.trial_patient_id || `Patient #${patient_id}`;
    const patientAge = patient?.date_of_birth ? calculateAge(patient.date_of_birth) : '—';
    const initials = getInitials(patientName);

    // ── MAIN RENDER ────────────────────────────────────────────────
    return (
        <div className="profile-container">

            {/* ── HERO HEADER ───────────────────────────────────────── */}
            <div className="patient-header">
                <div className="ph-main">
                    <div className="ph-avatar">{initials}</div>
                    <div className="ph-info">
                        <h1 className="ph-name">
                            {patientName}
                            <span className="ph-name-sub">
                                {patientAge !== '—' ? `${patientAge} yrs` : ''}{patient?.gender ? ` · ${patient.gender}` : ''}
                            </span>
                        </h1>
                        <div className="ph-meta">
                            {patient?.trial_patient_id && (
                                <span className="ph-patient-id">{patient.trial_patient_id}</span>
                            )}
                            {patient?.patient_status && (
                                <span className="ph-meta-chip">
                                    <span style={{ color: patient.patient_status.toLowerCase() === 'active' ? '#86efac' : '#fcd34d' }}>●</span>
                                    {patient.patient_status}
                                </span>
                            )}
                            {patient?.institution_name && (
                                <span className="ph-meta-chip">
                                    <MapPin size={11} /> {patient.institution_name}
                                </span>
                            )}
                            {patient?.enrollment_date && (
                                <span className="ph-meta-chip">
                                    <Calendar size={11} /> Enrolled {formatDate(patient.enrollment_date)}
                                </span>
                            )}
                            {patient?.treatment_arm && (
                                <span className="ph-meta-chip">
                                    <Activity size={11} /> Arm: {patient.treatment_arm}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="ph-actions">
                    <button className="btn-action btn-action-ghost" onClick={fetchPatientData}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button className="btn-action btn-action-ghost">
                        <Calendar size={14} /> Schedule Visit
                    </button>
                    {user?.role === 'Principal_Investigator' ? (
                        <button className="btn-action btn-action-white">
                            <PenTool size={14} /> Sign eCRF
                        </button>
                    ) : (
                        <button className="btn-action btn-action-white">
                            <Activity size={14} /> Enter Vitals
                        </button>
                    )}
                    <button className="btn-action btn-action-danger">
                        <AlertCircle size={14} /> Report AE
                    </button>
                </div>
            </div>

            {/* ── TABS ──────────────────────────────────────────────── */}
            <div className="profile-tabs-wrapper">
                <nav className="profile-tabs">
                    {[
                        { id: 'timeline', label: 'Timeline', icon: Clock },
                        { id: 'clinical', label: 'Clinical Data', icon: Activity },
                        { id: 'safety', label: 'Safety', icon: AlertTriangle },
                        { id: 'labs', label: 'Lab Results', icon: FileText },
                        { id: 'docs', label: 'Documents', icon: Clipboard },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <tab.icon size={15} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* ── CONTENT GRID ──────────────────────────────────────── */}
            <div className="profile-content">
                {/* ─── MAIN PANEL ──────────────────────────────────── */}
                <div>

                    {/* TIMELINE TAB */}
                    {activeTab === 'timeline' && (
                        <div className="tab-panel">
                            <div className="tab-panel-header">
                                <div className="tab-panel-icon icon-blue"><Clock size={18} /></div>
                                <h3>Patient Timeline</h3>
                            </div>
                            <div className="tab-panel-body">
                                {timeline.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon"><Clock size={20} /></div>
                                        <p>No timeline events found for this patient.</p>
                                    </div>
                                ) : (
                                    <div className="timeline-list">
                                        {timeline.map((event: any, index: number) => {
                                            const d = new Date(event.event_date);
                                            const accent = getTimelineAccent(event.event_type);
                                            return (
                                                <div key={index} className="timeline-item">
                                                    <div className="tl-date">
                                                        <div className={`tl-date-dot ${accent.dot}`} />
                                                        <span className="day">{d.getDate()}</span>
                                                        <span className="month">{d.toLocaleString('en-US', { month: 'short' })}</span>
                                                        <span className="year">{d.getFullYear()}</span>
                                                    </div>
                                                    <div className={`tl-content ${accent.card}`}>
                                                        <div className="tl-header">
                                                            <h3>{event.event_type}</h3>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span className={`tl-type-badge ${accent.badge}`}>{event.event_type}</span>
                                                                <span className="time">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                        <div className="tl-body">
                                                            <p>{event.description}</p>
                                                            {event.result_value && (
                                                                <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                                                    Value: <strong>{event.result_value}</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {event.visit_instance_id && (
                                                            <div className="tl-footer">
                                                                <button className="btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    View Visit Data <ChevronRight size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CLINICAL DATA TAB */}
                    {activeTab === 'clinical' && (
                        <div className="tab-panel">
                            <div className="tab-panel-header">
                                <div className="tab-panel-icon icon-blue"><Activity size={18} /></div>
                                <h3>Clinical Data</h3>
                            </div>
                            <div className="tab-panel-body">

                                {/* Visit Schedule */}
                                <div style={{ marginBottom: 'var(--spacing-8)' }}>
                                    <p className="clinical-section-title"><Calendar size={14} /> Visit Schedule</p>
                                    {clinical.visits?.length > 0 ? (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table className="labs-table">
                                                <thead>
                                                    <tr>
                                                        <th>Visit</th>
                                                        <th>Scheduled</th>
                                                        <th>Actual</th>
                                                        <th>Status</th>
                                                        <th>Window</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clinical.visits.map((v: any, idx: number) => (
                                                        <tr key={idx}>
                                                            <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{v.visit_name}</td>
                                                            <td>{formatDate(v.scheduled_date)}</td>
                                                            <td>{v.actual_visit_date ? formatDate(v.actual_visit_date) : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                                                            <td>
                                                                <span className={
                                                                    v.visit_status === 'Completed' ? 'badge-status badge-success' :
                                                                        v.visit_status === 'Scheduled' ? 'badge-status badge-primary' :
                                                                            'badge-status badge-gray'
                                                                }>{v.visit_status}</span>
                                                            </td>
                                                            <td><span className="badge-status badge-gray">{v.visit_window_status || '—'}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="empty-state"><div className="empty-state-icon"><Calendar size={20} /></div><p>No visits on file.</p></div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-6)' }}>
                                    {/* Vital Signs */}
                                    <div>
                                        <p className="clinical-section-title"><Activity size={14} /> Recent Vitals</p>
                                        {clinical.vitals?.length > 0 ? (
                                            clinical.vitals.slice(0, 3).map((v: any, idx: number) => (
                                                <div key={idx} className="vital-reading-card">
                                                    <div className="vital-timestamp">{new Date(v.measurement_time).toLocaleString()}</div>
                                                    <div className="vital-row">
                                                        <span>Blood Pressure</span>
                                                        <span className="vital-value">{v.systolic_bp}/{v.diastolic_bp} mmHg</span>
                                                    </div>
                                                    <div className="vital-row">
                                                        <span>Heart Rate</span>
                                                        <span className="vital-value">{v.heart_rate} bpm</span>
                                                    </div>
                                                    <div className="vital-row">
                                                        <span>Temp</span>
                                                        <span className="vital-value">{v.temperature}°C</span>
                                                    </div>
                                                    {v.oxygen_saturation && (
                                                        <div className="vital-row">
                                                            <span>SpO₂</span>
                                                            <span className="vital-value">{v.oxygen_saturation}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state"><div className="empty-state-icon"><Heart size={20} /></div><p>No vitals recorded.</p></div>
                                        )}
                                    </div>

                                    {/* Medical History */}
                                    <div>
                                        <p className="clinical-section-title"><Clipboard size={14} /> Medical History</p>
                                        {clinical.history?.length > 0 ? (
                                            clinical.history.map((h: any, idx: number) => (
                                                <div key={idx} className="history-card">
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)' }}>{h.condition_name}</div>
                                                        {h.notes && <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>{h.notes}</div>}
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 4 }}>
                                                            Dx: {h.diagnosis_date ? formatDate(h.diagnosis_date) : 'Unknown'}
                                                        </div>
                                                    </div>
                                                    <span className={h.is_active ? 'badge-status badge-danger' : 'badge-status badge-gray'} style={{ whiteSpace: 'nowrap' }}>
                                                        {h.is_active ? 'Active' : 'Resolved'}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state"><div className="empty-state-icon"><Clipboard size={20} /></div><p>No medical history on file.</p></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SAFETY TAB */}
                    {activeTab === 'safety' && (
                        <div className="tab-panel">
                            <div className="tab-panel-header">
                                <div className="tab-panel-icon icon-red"><AlertTriangle size={18} /></div>
                                <h3>Safety Monitoring</h3>
                            </div>
                            <div className="tab-panel-body">

                                {/* Adverse Events */}
                                <div style={{ marginBottom: 'var(--spacing-6)' }}>
                                    <p className="section-subtitle"><AlertTriangle size={13} /> Adverse Events</p>
                                    {safety.adverseEvents?.length > 0 ? (
                                        safety.adverseEvents.map((ae: any, idx: number) => (
                                            <div key={idx} className="ae-card">
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem', marginBottom: 4 }}>{ae.ae_term}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginBottom: 6 }}>
                                                        Causality: <strong>{ae.causality_relationship}</strong> · Treatment-Related: <strong>{ae.treatment_related ? 'Yes' : 'No'}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                                        {formatDate(ae.ae_start_date)} → {ae.ae_end_date ? formatDate(ae.ae_end_date) : 'Ongoing'}
                                                    </div>
                                                    {ae.sae_report_number && (
                                                        <div className="badge-status badge-danger" style={{ marginTop: 8, display: 'inline-block' }}>
                                                            SAE: {ae.sae_report_number}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Grade</div>
                                                    <div className="ae-grade-badge">{ae.severity_grade}</div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state"><div className="empty-state-icon"><AlertTriangle size={20} /></div><p>No adverse events reported.</p></div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-6)' }}>
                                    {/* Alerts */}
                                    <div>
                                        <p className="section-subtitle"><AlertCircle size={13} /> Safety Alerts</p>
                                        {safety.alerts?.length > 0 ? (
                                            safety.alerts.map((al: any, idx: number) => (
                                                <div key={idx} className={`alert-card ${al.alert_severity === 'CRITICAL' ? 'alert-card-critical' : 'alert-card-warning'}`}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{al.alert_code}</span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{new Date(al.alert_date).toLocaleDateString()}</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-800)', fontWeight: 500 }}>{al.alert_message}</p>
                                                    <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--gray-500)', textAlign: 'right' }}>
                                                        Status: <strong>{al.alert_status}</strong>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state"><div className="empty-state-icon"><AlertCircle size={20} /></div><p>No active safety alerts.</p></div>
                                        )}
                                    </div>

                                    {/* Protocol Deviations */}
                                    <div>
                                        <p className="section-subtitle"><Clipboard size={13} /> Protocol Deviations</p>
                                        {safety.protocolDeviations?.length > 0 ? (
                                            safety.protocolDeviations.map((pd: any, idx: number) => (
                                                <div key={idx} className="deviation-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span className={pd.deviation_type === 'Major' ? 'badge-status badge-danger' : 'badge-status badge-gray'}>
                                                            {pd.deviation_type}
                                                        </span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{formatDate(pd.deviation_date)}</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)' }}>{pd.description}</p>
                                                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        IRB Reported: {pd.reported_to_irb
                                                            ? <CheckCircle size={13} style={{ color: 'var(--color-success)' }} />
                                                            : <span style={{ color: 'var(--color-danger)' }}>No</span>}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state"><div className="empty-state-icon"><Clipboard size={20} /></div><p>No protocol deviations.</p></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LAB RESULTS TAB */}
                    {activeTab === 'labs' && (
                        <div className="tab-panel">
                            <div className="tab-panel-header">
                                <div className="tab-panel-icon icon-amber"><FileText size={18} /></div>
                                <h3>Laboratory Results</h3>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                {labs.length > 0 ? (
                                    <table className="labs-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Test</th>
                                                <th style={{ textAlign: 'right' }}>Result</th>
                                                <th>Unit</th>
                                                <th style={{ textAlign: 'center' }}>Ref Range</th>
                                                <th style={{ textAlign: 'center' }}>Flag</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {labs.map((l: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{new Date(l.result_date).toLocaleDateString()}</td>
                                                    <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{l.test_name}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: l.critical_result_flag === 'Y' ? 'var(--color-danger)' : 'var(--gray-800)' }}>
                                                        {l.result_value}
                                                    </td>
                                                    <td style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>{l.unit_of_measure}</td>
                                                    <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)' }}>
                                                        {l.reference_low} – {l.reference_high}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={getFlagChipClass(l.range_flag, l.critical_result_flag)}>
                                                            {l.critical_result_flag === 'Y' ? 'CRIT' : l.range_flag || 'Normal'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="empty-state"><div className="empty-state-icon"><FileText size={20} /></div><p>No lab results on file.</p></div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === 'docs' && (
                        <div className="tab-panel">
                            <div className="tab-panel-header">
                                <div className="tab-panel-icon icon-green"><Clipboard size={18} /></div>
                                <h3>Documents & Audit Trail</h3>
                            </div>
                            <div className="tab-panel-body">

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-6)' }}>
                                    {/* Informed Consent */}
                                    <div>
                                        <p className="section-subtitle"><CheckCircle size={13} /> Informed Consent</p>
                                        {documents.consent?.length > 0 ? (
                                            documents.consent.map((c: any, idx: number) => (
                                                <div key={idx} className="consent-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{ fontWeight: 700, color: '#1e40af' }}>Version {c.consent_version}</span>
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{formatDate(c.consent_date)}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', wordBreak: 'break-all' }}>
                                                        Sig: {c.digital_signature_hash?.substring(0, 20)}…
                                                    </div>
                                                    {c.is_withdrawn && (
                                                        <div className="badge-status badge-danger" style={{ marginTop: 8, display: 'inline-block' }}>
                                                            Withdrawn: {formatDate(c.withdrawal_date)}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state"><div className="empty-state-icon"><CheckCircle size={20} /></div><p>No consent records.</p></div>
                                        )}
                                    </div>

                                    {/* Signed eCRFs */}
                                    <div>
                                        <p className="section-subtitle"><PenTool size={13} /> Signed eCRFs</p>
                                        {documents.ecrfs?.length > 0 ? (
                                            documents.ecrfs.map((ecrf: any, idx: number) => (
                                                <div key={idx} className="ecrf-card">
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-800)' }}>{ecrf.ecrf_name}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                                            {new Date(ecrf.signed_at || ecrf.data_entry_date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <span className="badge-status badge-success">{ecrf.form_status}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state"><div className="empty-state-icon"><PenTool size={20} /></div><p>No signed eCRFs.</p></div>
                                        )}
                                    </div>
                                </div>

                                {/* Audit Trail */}
                                <div>
                                    <p className="section-subtitle"><Clock size={13} /> Audit Trail</p>
                                    {documents.auditTrail?.length > 0 ? (
                                        <div style={{ maxHeight: 260, overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                                            <table className="audit-table">
                                                <thead>
                                                    <tr>
                                                        <th>Timestamp</th>
                                                        <th>Table</th>
                                                        <th>Action</th>
                                                        <th>Reason</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {documents.auditTrail.map((a: any, idx: number) => (
                                                        <tr key={idx}>
                                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{new Date(a.change_timestamp).toLocaleString()}</td>
                                                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{a.table_name}</td>
                                                            <td><span className="badge-status badge-gray">{a.action_type}</span></td>
                                                            <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.change_reason || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="empty-state"><div className="empty-state-icon"><Clock size={20} /></div><p>No audit entries.</p></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── SIDEBAR ──────────────────────────────────────── */}
                <div>
                    {/* Demographics */}
                    <div className="sidebar-card">
                        <div className="sidebar-card-title"><User size={12} /> Demographics</div>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Date of Birth</label>
                                <span>{formatDate(patient?.date_of_birth)}</span>
                            </div>
                            <div className="info-item">
                                <label>Age</label>
                                <span>{patientAge} yrs</span>
                            </div>
                            <div className="info-item">
                                <label>Gender</label>
                                <span>{patient?.gender || '—'}</span>
                            </div>
                            <div className="info-item">
                                <label>Status</label>
                                <span className={getStatusBadgeClass(patient?.patient_status)}>{patient?.patient_status || '—'}</span>
                            </div>
                            <div className="info-item" style={{ gridColumn: 'span 2' }}>
                                <label>Enrolled</label>
                                <span>{formatDate(patient?.enrollment_date)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Site & Study */}
                    <div className="sidebar-card">
                        <div className="sidebar-card-title"><MapPin size={12} /> Site & Study</div>
                        <div className="info-grid">
                            <div className="info-item" style={{ gridColumn: 'span 2' }}>
                                <label>Site</label>
                                <span>{patient?.institution_name || `Site ${patient?.site_id}` || '—'}</span>
                            </div>
                            <div className="info-item" style={{ gridColumn: 'span 2' }}>
                                <label>Patient ID</label>
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{patient?.trial_patient_id || '—'}</span>
                            </div>
                            {patient?.treatment_arm && (
                                <div className="info-item" style={{ gridColumn: 'span 2' }}>
                                    <label>Treatment Arm</label>
                                    <span>{patient.treatment_arm}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Conditions at a glance */}
                    {clinical.history?.length > 0 && (
                        <div className="sidebar-card">
                            <div className="sidebar-card-title"><Heart size={12} /> Conditions</div>
                            {clinical.history.map((h: any, idx: number) => (
                                <div key={idx} className="medication-item">
                                    <div className={`medication-dot`} style={{ background: h.is_active ? 'var(--color-danger)' : 'var(--gray-300)' }} />
                                    <span style={{ flex: 1 }}>{h.condition_name}</span>
                                    <span className={h.is_active ? 'badge-status badge-danger' : 'badge-status badge-gray'} style={{ fontSize: '0.65rem' }}>
                                        {h.is_active ? 'Active' : 'Resolved'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Safety Summary */}
                    <div className="sidebar-card">
                        <div className="sidebar-card-title"><AlertTriangle size={12} /> Safety Summary</div>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>AEs</label>
                                <span style={{ color: safety.adverseEvents?.length > 0 ? 'var(--color-danger)' : 'var(--gray-600)' }}>
                                    {safety.adverseEvents?.length || 0}
                                </span>
                            </div>
                            <div className="info-item">
                                <label>Alerts</label>
                                <span style={{ color: safety.alerts?.length > 0 ? 'var(--color-warning)' : 'var(--gray-600)' }}>
                                    {safety.alerts?.length || 0}
                                </span>
                            </div>
                            <div className="info-item">
                                <label>Deviations</label>
                                <span>{safety.protocolDeviations?.length || 0}</span>
                            </div>
                            <div className="info-item">
                                <label>Labs</label>
                                <span>{labs.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
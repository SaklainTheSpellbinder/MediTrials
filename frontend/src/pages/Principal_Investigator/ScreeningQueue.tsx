import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardCheck, ArrowRight, Search, RefreshCw,
    CheckCircle, Clock, User,
} from 'lucide-react';
import { screeningAPI, patientAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Screening.css';

// ─── PI View: Pending Reviews ────────────────────────────────────────
const PIScreeningQueue: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.site_id) fetchPending();
    }, [user?.site_id]);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const data = await screeningAPI.getPendingPiReview(user!.site_id!);
            const pendingPatients = Array.isArray(data) ? data : (data.patients || []);
            setPending(pendingPatients);
        } catch { 
            setPending([]); 
        } finally { 
            setLoading(false); 
        }
    };

    const calcAge = (dob: string) => {
        try {
            const d = new Date(dob), t = new Date();
            let age = t.getFullYear() - d.getFullYear();
            const m = t.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
            return age;
        } catch { return '—'; }
    };

    return (
        <div className="screening-container">
            <div className="screening-page-header">
                <div>
                    <h1>Screening & Review</h1>
                    <p>Patients awaiting your review and sign-off</p>
                </div>
                <button className="btn-secondary" onClick={fetchPending} style={{ marginLeft: 'auto' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="screening-card">
                    <div className="screening-card-body" style={{ padding: 48, textAlign: 'center' }}>
                        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--gray-200)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 12px' }} />
                        <span style={{ color: 'var(--gray-400)' }}>Loading pending reviews…</span>
                    </div>
                </div>
            ) : pending.length === 0 ? (
                <div className="screening-card">
                    <div className="screening-card-body" style={{ padding: 48, textAlign: 'center' }}>
                        <CheckCircle size={40} style={{ color: 'var(--color-success)', margin: '0 auto 12px', display: 'block' }} />
                        <h3 style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>All caught up!</h3>
                        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>No screenings are pending your review.</p>
                    </div>
                </div>
            ) : (
                <div className="screening-card">
                    <div className="screening-card-header">
                        <div className="screening-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                            <Clock size={20} />
                        </div>
                        <div><h2>Pending Reviews ({pending.length})</h2><p>Click on a patient to review screening data</p></div>
                    </div>
                    <div className="screening-card-body" style={{ padding: 0 }}>
                        {pending.map((p, i) => (
                            <div
                                key={p.patient_id}
                                onClick={() => navigate(`/patients/screening/${p.patient_id}`)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '14px 20px', cursor: 'pointer',
                                    borderBottom: i < pending.length - 1 ? '1px solid var(--gray-100)' : 'none',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{
                                    width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: '0.85rem',
                                }}>
                                    <User size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-900)' }}>
                                        {p.full_name || p.trial_patient_id}
                                        <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: 8, fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                            {p.trial_patient_id}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                        {calcAge(p.date_of_birth)} yrs · {p.gender} · {p.institution_name || 'Site'}
                                    </div>
                                </div>
                                <span style={{
                                    padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                    background: '#fef3c7', color: '#92400e', textTransform: 'uppercase',
                                }}>
                                    Pending Review
                                </span>
                                <ArrowRight size={16} style={{ color: 'var(--gray-400)' }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Coordinator View: Screening Queue ────────────────────────────────
const CoordinatorScreeningQueue: React.FC = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => { fetchPatients(); }, []);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const data = await patientAPI.getAll();
            const rawPatients = Array.isArray(data) ? data : (data.patients || []);
            const screened = rawPatients.filter((p: any) =>
                p.patient_status === 'Screened' && !p.enrollment_date
            );
            setPatients(screened);
        } catch { 
            setPatients([]); 
        } finally { 
            setLoading(false); 
        }
    };

    const calcAge = (dob: string) => {
        try {
            const d = new Date(dob), t = new Date();
            let age = t.getFullYear() - d.getFullYear();
            const m = t.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
            return age;
        } catch { return '—'; }
    };

    const filtered = patients.filter(p => {
        const term = search.toLowerCase();
        return (
            p.trial_patient_id?.toLowerCase().includes(term) ||
            p.full_name?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="screening-container">
            <div className="screening-page-header">
                <div>
                    <h1>Screening & Consent</h1>
                    <p>Patients currently in screening — record consent and complete eligibility checklists</p>
                </div>
                <button className="btn-secondary" onClick={fetchPatients} style={{ marginLeft: 'auto' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="screening-card">
                    <div className="screening-card-body" style={{ padding: 48, textAlign: 'center' }}>
                        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--gray-200)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 12px' }} />
                        <span style={{ color: 'var(--gray-400)' }}>Loading screening queue…</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Search */}
                    <div style={{ marginBottom: 16, position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--gray-400)' }} />
                        <input
                            type="text" className="form-input" placeholder="Search by name or ID…"
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 36 }}
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <div className="screening-card">
                            <div className="screening-card-body" style={{ padding: 48, textAlign: 'center' }}>
                                <ClipboardCheck size={40} style={{ color: 'var(--gray-300)', margin: '0 auto 12px', display: 'block' }} />
                                <h3 style={{ fontWeight: 700, color: 'var(--gray-600)', marginBottom: 4 }}>No patients in screening</h3>
                                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Register a new patient from the Patient Registry to begin screening.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="screening-card">
                            <div className="screening-card-header">
                                <div className="screening-card-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                                    <ClipboardCheck size={20} />
                                </div>
                                <div><h2>Screening Queue ({filtered.length})</h2><p>Click a patient to open their screening checklist</p></div>
                            </div>
                            <div className="screening-card-body" style={{ padding: 0 }}>
                                {filtered.map((p, i) => (
                                    <div
                                        key={p.patient_id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '14px 20px', cursor: 'pointer',
                                            borderBottom: i < filtered.length - 1 ? '1px solid var(--gray-100)' : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{
                                            width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: '0.85rem',
                                        }}>
                                            <User size={18} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-900)' }}>
                                                {p.full_name || p.trial_patient_id}
                                                <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: 8, fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                                    {p.trial_patient_id}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>
                                                {calcAge(p.date_of_birth)} yrs · {p.gender}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                className="btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                                onClick={(e) => { e.stopPropagation(); navigate(`/patients/${p.patient_id}`); }}
                                            >
                                                Profile
                                            </button>
                                            <button
                                                className="btn-primary"
                                                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                                onClick={(e) => { e.stopPropagation(); navigate(`/patients/screening/${p.patient_id}`); }}
                                            >
                                                Screening <ArrowRight size={12} style={{ display: 'inline' }} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ─── Main Export (role-based) ─────────────────────────────────────────
export const ScreeningQueue: React.FC = () => {
    const { user } = useAuth();
    return user?.role === 'Principal_Investigator'
        ? <PIScreeningQueue />
        : <CoordinatorScreeningQueue />;
};

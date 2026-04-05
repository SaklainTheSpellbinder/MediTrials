import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Calendar as CalendarIcon, Clock, CheckCircle, Search,
    Plus, ArrowRight, User, X
} from 'lucide-react';
import { coordinatorAPI } from '../../services/api';
import './Coordinator.css';


interface Visit {
    visit_instance_id: number;
    full_name: string;
    trial_patient_id: string;
    visit_name: string;
    scheduled_date: string;
    visit_status: string;
    visit_window_status: string;
}

interface SchedulablePatient {
    patient_id: number;
    trial_patient_id: string;
    full_name: string;
}

interface VisitSchedule {
    visit_id: number;
    visit_name: string;
    visit_number: number;
    day_offset: number;
}


const ScheduleVisitModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const qc = useQueryClient();
    const [form, setForm] = useState({ patient_id: '', visit_id: '', scheduled_date: '' });
    const [error, setError] = useState('');

    const { data: patients = [] } = useQuery<SchedulablePatient[]>({
        queryKey: ['coord-patients'],
        queryFn: () => coordinatorAPI.getPatients(),
    });

    const { data: visitSchedules = [] } = useQuery<VisitSchedule[]>({
        queryKey: ['coord-visit-schedules'],
        queryFn: () => coordinatorAPI.getVisitSchedules(),
    });

    const scheduleMut = useMutation({
        mutationFn: () => coordinatorAPI.scheduleVisit({
            patient_id: parseInt(form.patient_id),
            visit_id: parseInt(form.visit_id),
            scheduled_date: form.scheduled_date,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['coord-today-visits'] });
            onClose();
        },
        onError: (e: any) => {
            setError(e.response?.data?.error || e.message || 'Failed to schedule visit.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.patient_id || !form.visit_id || !form.scheduled_date) {
            setError('All fields are required.');
            return;
        }
        scheduleMut.mutate();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: 'white', borderRadius: '1rem', width: 480,
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden'
            }}>
                <div style={{
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.125rem' }}>Schedule a Visit</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Create a new visit appointment for a patient</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label className="form-label">Patient <span style={{ color: '#dc2626' }}>*</span></label>
                        <select className="form-select" value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))} required>
                            <option value="">Select patient…</option>
                            {patients.map(p => (
                                <option key={p.patient_id} value={p.patient_id}>
                                    {p.trial_patient_id}{p.full_name ? ` — ${p.full_name}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="form-label">Visit Type <span style={{ color: '#dc2626' }}>*</span></label>
                        <select className="form-select" value={form.visit_id} onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))} required>
                            <option value="">Select visit type…</option>
                            {visitSchedules.map(v => (
                                <option key={v.visit_id} value={v.visit_id}>
                                    Visit {v.visit_number}: {v.visit_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="form-label">Scheduled Date <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                            type="date"
                            className="form-input"
                            value={form.scheduled_date}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.75rem', color: '#b91c1c', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
                        <button type="button" className="coord-btn-outline" style={{ flex: 1 }} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="coord-btn-primary"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            disabled={scheduleMut.isPending}
                        >
                            {scheduleMut.isPending ? (
                                <><div className="coord-spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> Scheduling…</>
                            ) : (
                                <><CalendarIcon size={16} /> Schedule Visit</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export const VisitManagement: React.FC = () => {
    const qc = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [checkingInId, setCheckingInId] = useState<number | null>(null);
    const [completingId, setCompletingId] = useState<number | null>(null);

    
    const { data: visits = [], isLoading } = useQuery<Visit[]>({
        queryKey: ['coord-today-visits'],
        queryFn: () => coordinatorAPI.getTodayVisits(),
        refetchInterval: 120000, 
    });

    // Check-in mutation
    const checkInMut = useMutation({
        mutationFn: (visitInstanceId: number) => coordinatorAPI.checkIn(visitInstanceId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['coord-today-visits'] });
            setCheckingInId(null);
        },
        onError: () => setCheckingInId(null),
    });

    const handleCheckIn = (visitInstanceId: number) => {
        setCheckingInId(visitInstanceId);
        checkInMut.mutate(visitInstanceId);
    };

    // Complete mutation
    const completeMut = useMutation({
        mutationFn: (visitInstanceId: number) => coordinatorAPI.completeVisit(visitInstanceId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['coord-today-visits'] });
            setCompletingId(null);
        },
        onError: () => setCompletingId(null),
    });

    const handleComplete = (visitInstanceId: number) => {
        setCompletingId(visitInstanceId);
        completeMut.mutate(visitInstanceId);
    };

    const filteredVisits = visits.filter(v =>
        v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.trial_patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const checkedInCount = visits.filter(v => ['Checked In', 'In Progress', 'Completed'].includes(v.visit_status)).length;

    return (
        <div className="coord-container">
            <div className="coord-flex-row-between" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <div className="coord-badge coord-badge-blue" style={{ marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <CalendarIcon size={12} /> Clinical Workflow
                    </div>
                    <h1 className="coord-page-title">Visit Management</h1>
                    <p className="coord-page-subtitle">Coordinate patient arrivals and schedule upcoming visits.</p>
                </div>

                <div className="coord-flex-row" style={{ gap: '1rem' }}>
                    <div style={{ position: 'relative', width: '280px' }}>
                        <input
                            type="text"
                            placeholder="Find patient..."
                            className="coord-input-field"
                            style={{ paddingLeft: '2.5rem', fontSize: '0.95rem' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                    </div>

                    <button
                        className="coord-btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', whiteSpace: 'nowrap' }}
                        onClick={() => setShowScheduleModal(true)}
                    >
                        <Plus size={18} /> Schedule Visit
                    </button>
                </div>
            </div>

            <div className="coord-grid-2-layout">
                {/* Left Column - Today's Visits */}
                <div className="coord-flex-col" style={{ gap: '1.25rem' }}>
                    <div className="coord-flex-row-between">
                        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={20} color="#4f46e5" />
                            Today's Expected Arrivals
                        </h2>
                        <div style={{ background: '#ffffff', padding: '0.5rem 1rem', borderRadius: '9999px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                            <span>
                                {checkedInCount} <span style={{ color: '#9ca3af', fontWeight: 500 }}>of</span> {visits.length} Checked In
                            </span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="coord-empty-state coord-content-card">
                            <div className="coord-spinner" style={{ width: '2.5rem', height: '2.5rem', color: '#4f46e5', borderWidth: '4px', marginBottom: '1rem' }}></div>
                            <p style={{ fontWeight: 700 }}>Syncing today's schedule...</p>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="coord-empty-state coord-content-card" style={{ borderStyle: 'dashed', borderColor: '#d1d5db' }}>
                            <div className="coord-empty-icon"><CheckCircle size={28} /></div>
                            <h3>All clear!</h3>
                            <p>No visits scheduled for today matching your criteria.</p>
                            <button className="coord-btn-primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowScheduleModal(true)}>
                                <Plus size={16} /> Schedule a Visit
                            </button>
                        </div>
                    ) : (
                        <div className="coord-flex-col" style={{ gap: '1rem' }}>
                            {filteredVisits.map((visit) => {
                                const isCompleted = visit.visit_status === 'Completed';
                                const isCheckedIn = ['Checked In', 'In Progress'].includes(visit.visit_status);
                                const isCheckingIn = checkingInId === visit.visit_instance_id || (checkInMut.isPending && checkingInId === visit.visit_instance_id);
                                const isCompleting = completingId === visit.visit_instance_id || (completeMut.isPending && completingId === visit.visit_instance_id);

                                return (
                                    <div key={visit.visit_instance_id} className="coord-action-card" style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1.25rem', background: isCompleted ? '#f0fdf4' : isCheckedIn ? '#eff6ff' : '#ffffff',
                                        borderColor: isCompleted ? '#bbf7d0' : isCheckedIn ? '#bfdbfe' : '#e5e7eb', flexWrap: 'wrap', gap: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                            <div style={{
                                                width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
                                                border: `2px solid ${isCompleted ? '#ffffff' : isCheckedIn ? '#ffffff' : '#f3f4f6'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isCompleted ? '#dcfce3' : isCheckedIn ? '#dbeafe' : '#f9fafb',
                                                color: isCompleted ? '#16a34a' : isCheckedIn ? '#2563eb' : '#6b7280'
                                            }}>
                                                <User size={24} strokeWidth={2.5} />
                                            </div>

                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.125rem', color: '#111827' }}>
                                                        {visit.full_name || visit.trial_patient_id}
                                                    </h3>
                                                    <span className="coord-badge coord-badge-blue" style={{ fontSize: '0.65rem' }}>
                                                        {visit.trial_patient_id}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: '#374151', background: '#f3f4f6', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                                                        <Clock size={12} color="#6b7280" />
                                                        {visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                                    </span>
                                                    <span style={{ fontWeight: 500, color: '#6b7280' }}>{visit.visit_name}</span>

                                                    {visit.visit_window_status && (
                                                        <span className={`coord-badge ${visit.visit_window_status.includes('Time') ? 'coord-badge-green' : visit.visit_window_status.includes('Close') ? 'coord-badge-yellow' : 'coord-badge-red'}`} style={{ fontSize: '0.65rem' }}>
                                                            {visit.visit_window_status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            {isCompleted ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: 800, fontSize: '0.875rem', padding: '0.75rem 1.5rem', background: '#dcfce3', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
                                                    <CheckCircle size={18} strokeWidth={2.5} />
                                                    Completed
                                                </div>
                                            ) : isCheckedIn ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1d4ed8', fontWeight: 800, fontSize: '0.875rem', padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
                                                        <Clock size={18} strokeWidth={2.5} />
                                                        In Progress
                                                    </div>
                                                    <button
                                                        onClick={() => handleComplete(visit.visit_instance_id)}
                                                        disabled={isCompleting}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#16a34a', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s', opacity: isCompleting ? 0.7 : 1 }}
                                                    >
                                                        {isCompleting ? (
                                                            <><div className="coord-spinner"></div></>
                                                        ) : (
                                                            <>Close Visit</>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleCheckIn(visit.visit_instance_id)}
                                                    disabled={isCheckingIn}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#111827', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s', opacity: isCheckingIn ? 0.7 : 1 }}
                                                >
                                                    {isCheckingIn ? (
                                                        <><div className="coord-spinner"></div> Processing...</>
                                                    ) : (
                                                        <>Check In <ArrowRight size={16} strokeWidth={3} /></>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Column - Coordinator Console */}
                {/* <div className="coord-flex-col" style={{ gap: '1.5rem' }}>
                    <div className="coord-content-card">
                        <div className="coord-card-header">
                            <h3><UserCheck size={20} color="#3b82f6" /> Morning Checklist</h3>
                        </div>
                        <div className="coord-card-body">
                            <div className="coord-flex-col" style={{ gap: '0.75rem' }}>
                                {[
                                    'Verify patient identity (ID/DOB)',
                                    'Confirm active ICF verbiage is signed',
                                    'Review concomitant medications lock',
                                    'Prepare laboratory sample kits'
                                ].map((item, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', border: '1px solid transparent' }}>
                                        <input type="checkbox" style={{ marginTop: '0.2rem', width: '1rem', height: '1rem', accentColor: '#4f46e5', cursor: 'pointer' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', lineHeight: 1.4 }}>{item}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div> */}
            </div>

            {showScheduleModal && <ScheduleVisitModal onClose={() => setShowScheduleModal(false)} />}
        </div>
    );
};

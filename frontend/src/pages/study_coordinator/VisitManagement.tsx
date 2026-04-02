import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle, Search, ChevronLeft, ChevronRight, Plus, UserCheck, AlertTriangle, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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

export const VisitManagement: React.FC = () => {
    const { user } = useAuth();
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'today' | 'calendar'>('today');
    const [checkingInId, setCheckingInId] = useState<number | null>(null);

    const fetchVisits = async () => {
        if (!user?.site_id) return;
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:5000/api/coordinator/visits/today?site_id=${user.site_id}`);
            if (response.ok) {
                const data = await response.json();
                setVisits(data);
            }
        } catch (error) {
            console.error("Error fetching visits:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVisits();
    }, [user?.site_id]);

    const handleCheckIn = async (visitInstanceId: number) => {
        setCheckingInId(visitInstanceId);
        try {
            const response = await fetch(`http://localhost:5000/api/coordinator/visits/checkin?site_id=${user?.site_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visit_instance_id: visitInstanceId })
            });

            if (response.ok) {
                await fetchVisits();
            } else {
                console.error(`Check-in failed`);
            }
        } catch (error) {
            console.error("Check-in error:", error);
        } finally {
            setCheckingInId(null);
        }
    };

    const filteredVisits = visits.filter(v =>
        v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.trial_patient_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const checkedInCount = visits.filter(v => ['Checked In', 'In Progress', 'Completed'].includes(v.visit_status)).length;

    const renderCalendar = () => (
        <div className="coord-content-card" style={{ padding: '2rem' }}>
            <div className="coord-flex-row-between" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Current Month</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="coord-btn-outline" style={{ display: 'flex', padding: '0.5rem', borderRadius: '0.5rem' }}><ChevronLeft size={18} /></button>
                        <button className="coord-btn-outline" style={{ display: 'flex', padding: '0.5rem', borderRadius: '0.5rem' }}><ChevronRight size={18} /></button>
                    </div>
                </div>
                <button className="coord-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '0.75rem' }}>
                    <Plus size={18} /> New Appointment
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem' }}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <div key={day} style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', paddingBottom: '0.5rem' }}>
                        {day}
                    </div>
                ))}

                {[...Array(35)].map((_, i) => {
                    const dayNum = (i % 31) + 1;
                    const isToday = dayNum === new Date().getDate() && i < 31;
                    const isNextMonth = i >= 31;

                    return (
                        <div key={i} style={{ 
                            minHeight: '120px', padding: '0.75rem', borderRadius: '0.75rem', 
                            border: `2px solid ${isToday ? '#bfdbfe' : '#f3f4f6'}`,
                            background: isToday ? '#eff6ff' : isNextMonth ? '#f9fafb' : '#ffffff',
                            color: isNextMonth ? '#d1d5db' : 'inherit'
                        }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 800, display: 'block', marginBottom: '0.5rem', color: isToday ? '#2563eb' : isNextMonth ? '#d1d5db' : '#6b7280' }}>
                                {dayNum}
                            </span>
                            {isToday && (
                                <div style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem', background: '#ffffff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 700, borderRadius: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.3rem' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3b82f6' }}></span> 3 Scheduled
                                </div>
                            )}
                            {(i === 12 || i === 18) && !isNextMonth && (
                                <div style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem', background: '#ffffff', border: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 700, borderRadius: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#9ca3af' }}></span> 1 Visit
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="coord-container">
            <div className="coord-flex-row-between" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <div className="coord-badge coord-badge-blue" style={{ marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <CalendarIcon size={12} /> Clinical Workflow
                    </div>
                    <h1 className="coord-page-title">Visit Management</h1>
                    <p className="coord-page-subtitle">Seamlessly coordinate arrivals and patient workflows.</p>
                </div>

                <div className="coord-flex-row">
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

                    <div style={{ background: '#f3f4f6', padding: '0.25rem', borderRadius: '0.75rem', display: 'flex', gap: '0.25rem', border: '1px solid #e5e7eb' }}>
                        <button
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: viewMode === 'today' ? '#ffffff' : 'transparent', color: viewMode === 'today' ? '#111827' : '#6b7280', boxShadow: viewMode === 'today' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                            onClick={() => setViewMode('today')}
                        >
                            Today's Visits
                        </button>
                        <button
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: viewMode === 'calendar' ? '#ffffff' : 'transparent', color: viewMode === 'calendar' ? '#111827' : '#6b7280', boxShadow: viewMode === 'calendar' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                            onClick={() => setViewMode('calendar')}
                        >
                            Calendar View
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'calendar' ? renderCalendar() : (
                <div className="coord-grid-2-layout">
                    {/* Left Column - Priority List */}
                    <div className="coord-flex-col" style={{ gap: '1.25rem' }}>
                        <div className="coord-flex-row-between">
                            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={20} color="#4f46e5" />
                                Expected Arrivals
                            </h2>
                            <div style={{ background: '#ffffff', padding: '0.5rem 1rem', borderRadius: '9999px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                                <span>
                                    {checkedInCount} <span style={{ color: '#9ca3af', fontWeight: 500 }}>of</span> {visits.length} Checked In
                                </span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="coord-empty-state coord-content-card">
                                <div className="coord-spinner" style={{ width: '2.5rem', height: '2.5rem', color: '#4f46e5', borderWidth: '4px', marginBottom: '1rem' }}></div>
                                <p style={{ fontWeight: 700 }}>Syncing today's schedule...</p>
                            </div>
                        ) : filteredVisits.length === 0 ? (
                            <div className="coord-empty-state coord-content-card" style={{ borderStyle: 'dashed', borderColor: '#d1d5db' }}>
                                <div className="coord-empty-icon"><CheckCircle size={28} /></div>
                                <h3>All clear!</h3>
                                <p>No pending visits matching your criteria.</p>
                            </div>
                        ) : (
                            <div className="coord-flex-col" style={{ gap: '1rem' }}>
                                {filteredVisits.map((visit) => {
                                    const isCheckedIn = ['Checked In', 'In Progress', 'Completed'].includes(visit.visit_status);
                                    const isCheckingIn = checkingInId === visit.visit_instance_id;

                                    return (
                                        <div key={visit.visit_instance_id} className="coord-action-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: isCheckedIn ? '#f0fdf4' : '#ffffff', borderColor: isCheckedIn ? '#bbf7d0' : '#e5e7eb', flexWrap: 'wrap', gap: '1.5rem' }}>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                {/* Patient Avatar Badge */}
                                                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', border: `2px solid ${isCheckedIn ? '#ffffff' : '#f3f4f6'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCheckedIn ? '#dcfce3' : '#f9fafb', color: isCheckedIn ? '#16a34a' : '#6b7280' }}>
                                                    <User size={24} strokeWidth={2.5} />
                                                </div>
                                                
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                                        <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.125rem', color: '#111827' }}>{visit.full_name || visit.trial_patient_id}</h3>
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
                                                            <span className={`coord-badge ${
                                                                visit.visit_window_status.includes('Time') ? 'coord-badge-green' :
                                                                visit.visit_window_status.includes('Close') ? 'coord-badge-yellow' :
                                                                'coord-badge-red'}`} style={{ fontSize: '0.65rem' }}>
                                                                {visit.visit_window_status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                {isCheckedIn ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: 800, fontSize: '0.875rem', padding: '0.75rem 1.5rem', background: '#dcfce3', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
                                                        <CheckCircle size={18} strokeWidth={2.5} />
                                                        Checked In
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
                    <div className="coord-flex-col" style={{ gap: '1.5rem' }}>
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

                        <div className="coord-action-card" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderColor: '#fde68a' }}>
                            <div style={{ position: 'absolute', top: '-1rem', right: '-1rem', width: '6rem', height: '6rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', filter: 'blur(10px)' }}></div>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', marginBottom: '0.5rem', position: 'relative', zIndex: 10 }}>
                                <AlertTriangle size={20} color="#f59e0b" /> Action Required
                            </h3>
                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#92400e', opacity: 0.8, lineHeight: 1.5, position: 'relative', zIndex: 10 }}>
                                Pending PK samples from Visit 2 need immediate dispatch to central lab. Courier arrives at 14:00.
                            </p>
                            <button style={{ marginTop: '1rem', color: '#b45309', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', zIndex: 10 }}>
                                View details <ArrowRight size={12} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Users, TestTube, ArrowRight, Clock, ShieldAlert, Activity, CalendarDays, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Coordinator.css';
import { coordinatorAPI } from '../../services/api';

export interface CoordinatorStats {
    today_visits: number;
    pending_labs: number;
    incomplete_ecrfs: number;
    open_queries: number;
}

export interface CoordinatorVisit {
    visit_instance_id: number;
    full_name: string;
    trial_patient_id: string;
    visit_name: string;
    visit_status: string;
    scheduled_date: string;
}

export const CoordinatorDashboard: React.FC = () => {
    const { user } = useAuth();

    // Fetch Stats
    const { data: stats, isLoading: statsLoading } = useQuery<CoordinatorStats>({
        queryKey: ['coordinator-stats', user?.site_id],
        queryFn: () => coordinatorAPI.getStats(),
        enabled: !!user?.site_id,
        refetchInterval: 60000,
    });

    // Fetch Today's Visits
    const { data: todaysVisits = [], isLoading: visitsLoading } = useQuery<CoordinatorVisit[]>({
        queryKey: ['coordinator-visits-today', user?.site_id],
        queryFn: () => coordinatorAPI.getTodaysVisits(),
        enabled: !!user?.site_id,
        refetchInterval: 60000,
    });

    const loading = statsLoading || visitsLoading;

    if (loading) {
        return (
            <div className="coord-empty-state" style={{ minHeight: '60vh' }}>
                <div className="coord-spinner" style={{ width: '2.5rem', height: '2.5rem', borderWidth: '4px', color: '#4f46e5', marginBottom: '1rem' }}></div>
                <p>Syncing Coordinator Hub...</p>
            </div>
        );
    }

    return (
        <div className="coord-container">
            {/* Header Section */}
            <div className="coord-flex-row-between" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <h1 className="coord-page-title">
                        Welcome back, <span style={{ color: '#4f46e5' }}>{user?.full_name || 'Coordinator'}</span>
                    </h1>
                    <p className="coord-page-subtitle">Here is your clinical command center for today.</p>
                </div>
                <Link to="/visits" className="coord-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #c7d2fe', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 'bold', textDecoration: 'none' }}>
                    <CalendarDays size={18} /> View Master Calendar
                </Link>
            </div>

            {/* Quick Actions Grid using Vanilla Premium Classes */}
            <h2 className="coord-section-title">Quick Operation Links</h2>
            <div className="coord-grid-3">
                <Link to="/visits" className="coord-action-card coord-card-blue" style={{ textDecoration: 'none' }}>
                    <div className="coord-flex-row-between" style={{ marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                        <div className="coord-action-icon"><CalendarCheck size={28} /></div>
                        <ArrowRight size={18} style={{ color: '#9ca3af' }} />
                    </div>
                    <h3 style={{ color: '#1e293b' }}>Patient Check-In</h3>
                    <p style={{ color: '#64748b' }}>
                        <span className="coord-highlight">{stats?.today_visits || 0}</span> visits scheduled today
                    </p>
                </Link>

                <Link to="/visits" className="coord-action-card coord-card-purple" style={{ textDecoration: 'none' }}>
                    <div className="coord-flex-row-between" style={{ marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                        <div className="coord-action-icon"><Users size={28} /></div>
                        <ArrowRight size={18} style={{ color: '#9ca3af' }} />
                    </div>
                    <h3 style={{ color: '#1e293b' }}>Schedule Visit</h3>
                    <p style={{ color: '#64748b' }}>Manage patient future appointments</p>
                </Link>

                <Link to="/labs/entry" className="coord-action-card coord-card-teal" style={{ textDecoration: 'none' }}>
                    <div className="coord-flex-row-between" style={{ marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                        <div className="coord-action-icon"><TestTube size={28} /></div>
                        <ArrowRight size={18} style={{ color: '#9ca3af' }} />
                    </div>
                    <h3 style={{ color: '#1e293b' }}>Post Lab Results</h3>
                    <p style={{ color: '#64748b' }}>
                        <span className="coord-highlight">{stats?.pending_labs || 0}</span> labs await entry
                    </p>
                </Link>
            </div>

            {/* Content Layout */}
            <div className="coord-grid-2-layout">
                {/* Left Column: Tasks */}
                <div className="coord-flex-col" style={{ gap: '1.5rem' }}>
                    <div className="coord-content-card">
                        <div className="coord-card-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><ShieldAlert size={20} color="#f59e0b" /> Administrative Backlog</h3>
                            <span className="coord-badge coord-badge-red">
                                {((stats?.incomplete_ecrfs || 0) + (stats?.open_queries || 0))} Issues
                            </span>
                        </div>
                        
                        <div className="coord-card-body no-padding">
                            {(stats?.incomplete_ecrfs ?? 0) > 0 && (
                                <div className="coord-list-item">
                                    <div className="coord-item-icon coord-icon-warning"><Activity size={20} /></div>
                                    <div className="coord-item-content">
                                        <h4 className="coord-item-title">{stats?.incomplete_ecrfs} Incomplete eCRFs</h4>
                                        <p className="coord-item-desc">Missing required patient trial signatures</p>
                                    </div>
                                    <Link to="/ecrf" className="coord-item-action coord-btn-outline" style={{ color: '#4f46e5', borderColor: '#c7d2fe', textDecoration: 'none' }}>Resolve</Link>
                                </div>
                            )}

                            {(stats?.open_queries ?? 0) > 0 && (
                                <div className="coord-list-item">
                                    <div className="coord-item-icon coord-icon-danger"><ShieldAlert size={20} /></div>
                                    <div className="coord-item-content">
                                        <h4 className="coord-item-title">{stats?.open_queries} Open Data Queries</h4>
                                        <p className="coord-item-desc">Data Manager has flagged discrepancies</p>
                                    </div>
                                    <Link to="/ecrf" className="coord-item-action coord-btn-outline" style={{ color: '#4f46e5', borderColor: '#c7d2fe', textDecoration: 'none' }}>Review</Link>
                                </div>
                            )}

                            {!stats?.incomplete_ecrfs && !stats?.open_queries && (
                                <div className="coord-empty-state">
                                    <div className="coord-empty-icon" style={{ background: '#dcfce3', color: '#16a34a' }}><CheckCircle size={32} /></div>
                                    <h4>You are completely caught up!</h4>
                                    <p>No pending queries or eCRF backlogs.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Schedule Agenda */}
                <div className="coord-flex-col" style={{ gap: '1.5rem' }}>
                    <div className="coord-content-card" style={{ height: '100%' }}>
                         <div className="coord-card-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Clock size={20} color="#3b82f6" /> Today's Itinerary</h3>
                            <Link to="/visits" style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#4f46e5', textDecoration: 'none' }}>Complete View &rarr;</Link>
                        </div>
                        
                        <div className="coord-card-body" style={{ background: '#f9fafb' }}>
                            {todaysVisits.length === 0 ? (
                                <div className="coord-empty-state" style={{ padding: '2rem 1rem' }}>
                                    <div className="coord-empty-icon"><CalendarDays size={28} /></div>
                                    <h4>No patients booked</h4>
                                    <p>Enjoy the peaceful itinerary today.</p>
                                </div>
                            ) : (
                                <div className="coord-timeline">
                                    {todaysVisits.map((visit, index) => {
                                        const isDone = ['Checked In', 'In Progress', 'Completed'].includes(visit.visit_status);
                                        return (
                                        <div key={index} className={`coord-timeline-item ${isDone ? 'done' : ''}`}>
                                            <div className="coord-timeline-dot"></div>
                                            
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                                <div style={{ flex: '0 0 70px' }}>
                                                    <div className="coord-timeline-time">
                                                        {visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                                    </div>
                                                </div>
                                                
                                                <div className="coord-timeline-card" style={{ flex: 1 }}>
                                                    <div>
                                                        <h4 className="coord-timeline-name" style={{ margin: '0 0 4px', color: '#1e293b' }}>
                                                            {visit.full_name} <span className="coord-badge coord-badge-gray" style={{ marginLeft: '0.5rem' }}>{visit.trial_patient_id}</span>
                                                        </h4>
                                                        <div className="coord-timeline-details" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.85rem' }}>
                                                            <Activity size={14} /> {visit.visit_name} &bull; {visit.visit_status}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
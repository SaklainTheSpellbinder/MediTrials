import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Users,
    UserCheck,
    UserX,
    AlertCircle,
    Calendar,
    TrendingUp,
    Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI } from '../../services/api';
import { StatCard } from '../../components/dashboard/StatCard';
import { PendingScreeningsWidget } from '../../components/dashboard/PendingScreeningsWidget';
import '../Dashboard.css';

export const PIDashboard: React.FC = () => {
    const { user } = useAuth();

    // 1. Fetch Materialized View Stats
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['pi-stats', user?.site_id],
        queryFn: () => dashboardAPI.getPIStats(),
        enabled: !!user?.site_id,
    });

    // 2. Fetch Alerts (AEs, Critical Labs, Deviations)
    const { data: alerts = [], isLoading: alertsLoading } = useQuery({
        queryKey: ['pi-alerts', user?.site_id],
        queryFn: () => dashboardAPI.getAlerts(),
        enabled: !!user?.site_id,
    });

    // 3. Fetch Today's Schedule
    const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
        queryKey: ['pi-schedule', user?.site_id],
        queryFn: () => dashboardAPI.getTodaysSchedule(),
        enabled: !!user?.site_id,
    });

    if (statsLoading || alertsLoading || scheduleLoading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <div className="coord-spinner" style={{ width: '3rem', height: '3rem', borderWidth: '4px', color: '#4f46e5' }} />
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Principal Investigator Dashboard</h1>
                    <p className="text-gray-500 text-sm">Site: {user?.site_id || 'Unknown'}</p>
                </div>
            </div>

            {/* KPI Cards mapping directly to mv_pi_dashboard_stats columns */}
            <div className="stats-grid">
                <StatCard
                    label="Total Patients"
                    value={stats?.total_patients || 0}
                    icon={Users}
                    color="primary"
                />
                <StatCard
                    label="Active Patients"
                    value={stats?.active_patients || 0}
                    icon={UserCheck}
                    color="success"
                />
                <StatCard
                    label="Screen Failures"
                    value={stats?.screen_failures || 0}
                    icon={UserX}
                    color="warning"
                />
                <StatCard
                    label="Retention Rate"
                    value={`${stats?.retention_rate || 0}%`}
                    icon={TrendingUp}
                    color="info"
                />
            </div>

            <div className="dashboard-layout">
                {/* Left Column: Alerts & Enrollment */}
                <div className="dash-col-left">
                    
                    {/* Dynamic Safety Alerts */}
                    <div className="card alert-card">
                        <div className="card-header">
                            <h3 className="card-title text-danger">
                                <AlertCircle size={20} />
                                Safety Alerts ({alerts.length})
                            </h3>
                        </div>
                        <div className="alert-list">
                            {alerts.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                                    No active safety alerts for your site.
                                </div>
                            ) : (
                                alerts.map((alert: any, index: number) => (
                                    <div key={index} className={`alert-item ${alert.severity === 'Urgent' ? 'urgent' : alert.severity === 'High' ? 'high' : 'medium'}`}>
                                        <div className="alert-content">
                                            <span className="alert-patient">{alert.patient_id || 'System'}</span>
                                            <p>{alert.message}</p>
                                        </div>
                                        <button className={`btn-xs ${alert.severity === 'Urgent' ? 'btn-danger-outline' : ''}`}>
                                            Review
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Dynamic Enrollment Progress (using MV logic) */}
                    <div className="card my-4">
                        <div className="card-header">
                            <h3 className="card-title">
                                <Users size={18} />
                                Enrollment Progress
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="progress-label">
                                <span className="font-bold text-lg">{stats?.enrollment_percentage || 0}%</span>
                                <span className="text-gray-500">of target ({stats?.enrollment_current || 0}/{stats?.enrollment_target || 0})</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div 
                                    className="progress-bar-fill" 
                                    style={{ width: `${Math.min(parseFloat(stats?.enrollment_percentage) || 0, 100)}%`, background: '#4f46e5' }}
                                ></div>
                            </div>
                            <div className="progress-meta text-warning mt-2 flex items-center gap-2">
                                <Clock size={14} />
                                <span className="text-sm">
                                    Last Refreshed: {stats?.last_refreshed ? new Date(stats.last_refreshed).toLocaleTimeString() : 'Just now'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <PendingScreeningsWidget />
                </div>

                {/* Right Column: Schedule & Tasks */}
                <div className="dash-col-right">
                    <div className="card h-full">
                        <div className="card-header">
                            <h3 className="card-title">
                                <Calendar size={18} />
                                Today's Schedule
                            </h3>
                            <span className="badge-neutral">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="schedule-list">
                            {schedule.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                                    No visits scheduled for today.
                                </div>
                            ) : (
                                schedule.map((visit: any, index: number) => (
                                    <div key={index} className="schedule-item">
                                        <div className="time-col">
                                            {new Date(visit.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="event-col">
                                            <strong>{visit.trial_patient_id}</strong>
                                            <span className="event-type">{visit.visit_name}</span>
                                        </div>
                                        <div className="status-col">
                                            <span className={`status-badge ${visit.visit_status.toLowerCase() === 'checked in' ? 'active' : visit.visit_status.toLowerCase() === 'completed' ? 'done' : 'pending'}`}>
                                                {visit.visit_status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
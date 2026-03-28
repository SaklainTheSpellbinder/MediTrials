import React, { useState, useEffect } from 'react';
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
import { StatCard } from '../../components/dashboard/StatCard';
import { PendingScreeningsWidget } from '../../components/dashboard/PendingScreeningsWidget';
import '../Dashboard.css';

export const PIDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            if (!user?.site_id) {
                // Fallback for demo/dev if no site_id
                setStats({
                    total_patients: 142,
                    active_patients: 89,
                    screen_failures: 12,
                    retention_rate: 96,
                    enrollment_current: 89,
                    enrollment_target: 140,
                    enrollment_percentage: 63.5
                });
                setLoading(false);
                return;
            }

            try {
                // Fetch from the Materialized View endpoint
                const response = await fetch(`http://localhost:5000/api/dashboard/stats?site_id=${user.site_id}`);
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                } else {
                    console.error("Failed to fetch dashboard stats");
                }
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardStats();
    }, [user?.site_id]);

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">MediTrials Dashboard</h1>
                    <p className="text-gray-500 text-sm">Last updated: Today, 09:30 AM</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary">Export Report</button>
                    <button className="btn-primary">+ Register Subject</button>
                </div>
            </div>

            {/* Stats Grid */}
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
                    subValue="8% failure rate"
                    icon={UserX}
                    color="warning"
                />
                <StatCard
                    label="Retention Rate"
                    value={`${stats?.retention_rate || 0}%`}
                    subValue="+2% vs target"
                    icon={TrendingUp}
                    color="info"
                />
            </div>

            <div className="dashboard-layout">
                {/* Left Column: Alerts & Enrollment */}
                <div className="dash-col-left">
                    {/* Safety Alerts */}
                    <div className="card alert-card">
                        <div className="card-header">
                            <h3 className="card-title text-danger">
                                <AlertCircle size={20} />
                                Safety Alerts (3 Urgent)
                            </h3>
                        </div>
                        <div className="alert-list">
                            <div className="alert-item urgent">
                                <div className="alert-content">
                                    <span className="alert-patient">Patient #45</span>
                                    <p>Grade 4 AE - Anaphylaxis. Needs immediate reporting.</p>
                                </div>
                                <button className="btn-xs btn-danger-outline">Report</button>
                            </div>
                            <div className="alert-item high">
                                <div className="alert-content">
                                    <span className="alert-patient">Patient #12</span>
                                    <p>Critical lab value - AST 300 U/L (5x ULN)</p>
                                </div>
                                <button className="btn-xs">Review</button>
                            </div>
                            <div className="alert-item medium">
                                <div className="alert-content">
                                    <span className="alert-tag">Protocol</span>
                                    <p>Visit window exceeded for PT-00123 (Visit 4)</p>
                                </div>
                                <button className="btn-xs">Details</button>
                            </div>
                        </div>
                    </div>

                    {/* Enrollment Progress */}
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
                                <div className="progress-bar-fill" style={{ width: `${Math.min(stats?.enrollment_percentage || 0, 100)}%` }}></div>
                            </div>
                            <div className="progress-meta text-warning mt-2 flex items-center gap-2">
                                <Clock size={14} />
                                <span className="text-sm">Status: In Progress</span>
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
                            <span className="badge-neutral">Jan 15, 2024</span>
                        </div>
                        <div className="schedule-list">
                            <div className="schedule-item">
                                <div className="time-col">09:00</div>
                                <div className="event-col">
                                    <strong>PT-00456</strong>
                                    <span className="event-type">Visit 3 - Follow up</span>
                                </div>
                                <div className="status-col">
                                    <span className="status-badge done">Done</span>
                                </div>
                            </div>

                            <div className="schedule-item">
                                <div className="time-col">11:30</div>
                                <div className="event-col">
                                    <strong>PT-00987</strong>
                                    <span className="event-type">Screening Visit</span>
                                </div>
                                <div className="status-col">
                                    <span className="status-badge active">Now</span>
                                </div>
                            </div>

                            <div className="schedule-item">
                                <div className="time-col">14:00</div>
                                <div className="event-col">
                                    <strong>Site Meeting</strong>
                                    <span className="event-type">AE Review Board</span>
                                </div>
                                <div className="status-col">
                                    <span className="status-badge pending">Pending</span>
                                </div>
                            </div>

                            <div className="schedule-item">
                                <div className="time-col">16:30</div>
                                <div className="event-col">
                                    <strong>PT-00112</strong>
                                    <span className="event-type">Unscheduled Visit</span>
                                </div>
                                <div className="status-col">
                                    <span className="status-badge pending">Pending</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

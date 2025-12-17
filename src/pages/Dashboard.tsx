import React from 'react';
import {
    Users,
    UserCheck,
    UserX,
    AlertCircle,
    Calendar,
    TrendingUp,
    Clock
} from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Site 101 Dashboard</h1>
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
                    value="142"
                    icon={Users}
                    color="primary"
                />
                <StatCard
                    label="Active Patients"
                    value="89"
                    icon={UserCheck}
                    color="success"
                />
                <StatCard
                    label="Screen Failures"
                    value="12"
                    subValue="8% failure rate"
                    icon={UserX}
                    color="warning"
                />
                <StatCard
                    label="Retention Rate"
                    value="95%"
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
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                <Users size={18} />
                                Enrollment Progress
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="progress-label">
                                <span className="font-bold text-lg">65%</span>
                                <span className="text-gray-500">of target (89/140)</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: '65%' }}></div>
                            </div>
                            <div className="progress-meta text-warning mt-2 flex items-center gap-2">
                                <Clock size={14} />
                                <span className="text-sm">2 weeks behind schedule</span>
                            </div>
                        </div>
                    </div>
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

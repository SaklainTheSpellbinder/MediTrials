import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    FileText,
    Clock,
    Clipboard
} from 'lucide-react';
import './PatientProfile.css';

export const PatientProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState('timeline');

    return (
        <div className="profile-container">
            {/* Patient Header */}
            <div className="patient-header card">
                <div className="ph-main">
                    <div className="ph-avatar">JD</div>
                    <div>
                        <h1 className="ph-name">John Doe <span className="text-gray-500 font-normal">(45/M)</span></h1>
                        <div className="ph-meta">
                            <span className="font-mono text-primary">{id || 'PT-00123'}</span>
                            <span className="divider">•</span>
                            <span>Site: 101</span>
                            <span className="divider">•</span>
                            <span className="badge-success">Active</span>
                        </div>
                    </div>
                </div>
                <div className="ph-actions">
                    <button className="btn-secondary">Schedule Visit</button>
                    <button className="btn-secondary text-danger border-danger">Report AE</button>
                    <button className="btn-primary">View eCRF</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="profile-tabs">
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
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="profile-content">
                <div className="content-main">
                    {/* Timeline View */}
                    {activeTab === 'timeline' && (
                        <div className="timeline-list">
                            <div className="timeline-item">
                                <div className="tl-date">
                                    <span className="day">15</span>
                                    <span className="month">Jan</span>
                                    <span className="year">2024</span>
                                </div>
                                <div className="tl-line"></div>
                                <div className="tl-content card">
                                    <div className="tl-header">
                                        <h3>Visit 3: Completed</h3>
                                        <span className="time">09:30 AM</span>
                                    </div>
                                    <div className="tl-body">
                                        <ul>
                                            <li><Activity size={14} className="inline mr-2 text-success" /> Vitals collected: BP 120/80</li>
                                            <li><FileText size={14} className="inline mr-2 text-primary" /> Labs drawn: Chem-7, CBC</li>
                                            <li><AlertTriangle size={14} className="inline mr-2 text-warning" /> AE Reported: Mild Headache (Grade 1)</li>
                                        </ul>
                                    </div>
                                    <div className="tl-footer">
                                        <button className="btn-xs">View Visit Data</button>
                                    </div>
                                </div>
                            </div>

                            <div className="timeline-item">
                                <div className="tl-date">
                                    <span className="day">10</span>
                                    <span className="month">Dec</span>
                                    <span className="year">2023</span>
                                </div>
                                <div className="tl-line"></div>
                                <div className="tl-content card">
                                    <div className="tl-header">
                                        <h3>Visit 2: Follow-up</h3>
                                        <span className="time">10:00 AM</span>
                                    </div>
                                    <div className="tl-body">
                                        <p>Routine follow-up. No adverse events reported. Study drug dispensed.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="timeline-item">
                                <div className="tl-date">
                                    <span className="day">15</span>
                                    <span className="month">Nov</span>
                                    <span className="year">2023</span>
                                </div>
                                <div className="tl-line"></div>
                                <div className="tl-content card">
                                    <div className="tl-header">
                                        <h3>Visit 1: Randomization</h3>
                                        <span className="time">14:15 PM</span>
                                    </div>
                                    <div className="tl-body">
                                        <p>Patient randomized to <strong>Arm B</strong>.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'timeline' && (
                        <div className="card p-6 text-center text-gray-400">
                            <p>Module {activeTab} is under development.</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="content-sidebar">
                    <div className="card p-4 mb-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Demographics</h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>DOB</label>
                                <span>1979-05-12</span>
                            </div>
                            <div className="info-item">
                                <label>Race</label>
                                <span>Caucasian</span>
                            </div>
                            <div className="info-item">
                                <label>Height</label>
                                <span>178 cm</span>
                            </div>
                            <div className="info-item">
                                <label>Weight</label>
                                <span>82 kg</span>
                            </div>
                        </div>
                    </div>

                    <div className="card p-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">Current Meds</h4>
                        <ul className="text-sm space-y-2">
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Lisinopril 10mg
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                Atorvastatin 20mg
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

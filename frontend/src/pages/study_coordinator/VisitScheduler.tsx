import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.css';
import './VisitScheduler.css';

export const VisitScheduler: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="dashboard-container scheduler-container">
            {/* Header */}
            <div className="section-header">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="back-button">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title">Visit Scheduler</h1>
                        <p className="text-gray-500 text-sm">Manage patient appointments</p>
                    </div>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <Plus size={16} />
                    New Appointment
                </button>
            </div>

            <div className="calendar-card">
                <div className="calendar-header">
                    <div className="flex items-center gap-4">
                        <h2 className="calendar-title">January 2024</h2>
                        <div className="calendar-controls">
                            <button className="nav-btn"><ChevronLeft size={20} /></button>
                            <button className="nav-btn"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="view-btn">Week</button>
                        <button className="view-btn active">Month</button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="calendar-grid">
                    {/* Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="day-header">
                            {day}
                        </div>
                    ))}

                    {/* Days */}
                    {[...Array(35)].map((_, i) => {
                        const day = i - 2; // Offset to start month correctly mock
                        const isToday = day === 15;
                        const isOtherMonth = i < 3 || i > 33;

                        return (
                            <div key={i} className={`calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}>
                                <div className="day-number">
                                    {day > 0 && day <= 31 ? day : (day <= 0 ? 31 + day : day - 31)}
                                </div>

                                {day === 15 && (
                                    <>
                                        <div className="event-item event-visit">
                                            <span className="event-time">09:00</span>
                                            PT-00123
                                        </div>
                                        <div className="event-item event-screening">
                                            <span className="event-time">14:00</span>
                                            PT-00456
                                        </div>
                                    </>
                                )}

                                {day === 18 && (
                                    <div className="event-item event-safety">
                                        <span className="event-time">11:30</span>
                                        PT-00789
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

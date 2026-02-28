import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle, Search, ChevronLeft, ChevronRight, Plus, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import '../Dashboard.css';

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

    const fetchVisits = async () => {
        if (!user?.site_id) return;
        setLoading(true);
        try {
            // Reusing the same endpoint that gets today's visits for the list view
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
        try {
            const response = await fetch(`http://localhost:5000/api/coordinator/visits/checkin?site_id=${user?.site_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visit_instance_id: visitInstanceId })
            });

            if (response.ok) {
                await fetchVisits();
            } else {
                const err = await response.json();
                alert(`Check-in failed: ${err.error}`);
            }
        } catch (error) {
            console.error("Check-in error:", error);
            alert("Failed to check in patient");
        }
    };

    const filteredVisits = visits.filter(v =>
        v.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.trial_patient_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const checkedInCount = visits.filter(v => ['Checked In', 'In Progress', 'Completed'].includes(v.visit_status)).length;

    // --- Mock Calendar Render ---
    const renderCalendar = () => (
        <div className="card mt-4 p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Current Month</h2>
                    <div className="flex gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded text-gray-500"><ChevronLeft size={20} /></button>
                        <button className="p-1 hover:bg-gray-100 rounded text-gray-500"><ChevronRight size={20} /></button>
                    </div>
                </div>
                <button className="btn-primary btn-sm flex items-center gap-2">
                    <Plus size={16} /> New Appointment
                </button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-gray-50 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}

                {/* Mock Days */}
                {[...Array(35)].map((_, i) => {
                    const dayNum = (i % 31) + 1;
                    const isToday = dayNum === new Date().getDate();

                    return (
                        <div key={i} className={`bg-white min-h-[100px] p-2 ${isToday ? 'bg-blue-50/30 ring-1 ring-inset ring-blue-500' : ''}`}>
                            <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                                {dayNum}
                            </span>
                            {isToday && (
                                <div className="mt-2 text-xs p-1 bg-blue-100 text-blue-800 rounded border border-blue-200 truncate">
                                    3 Visits Today
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="dashboard-container max-w-6xl mx-auto">
            <div className="section-header flex-col sm:flex-row items-start sm:items-center gap-4">
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        <CalendarIcon size={24} className="text-blue-600" />
                        Visit Management
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Check-in patients and manage the site schedule.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <input
                            type="text"
                            placeholder="Search patient..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>

                    {/* View Switcher */}
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1 border border-gray-200">
                        <button
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            onClick={() => setViewMode('today')}
                        >
                            Today's Visits
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            onClick={() => setViewMode('calendar')}
                        >
                            Calendar
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'calendar' ? renderCalendar() : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    {/* Left Column - Visit List */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Clock size={18} className="text-gray-500" />
                                Expected Arrivals
                            </h2>
                            <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                                {checkedInCount} / {visits.length} Checked In
                            </span>
                        </div>

                        {loading ? (
                            <div className="card p-12 flex flex-col items-center justify-center text-gray-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                                Loading today's visits...
                            </div>
                        ) : filteredVisits.length === 0 ? (
                            <div className="card p-12 text-center text-gray-500">
                                <CalendarIcon size={48} className="mx-auto text-gray-300 mb-3" />
                                No visits scheduled for today matching your criteria.
                            </div>
                        ) : (
                            filteredVisits.map((visit) => {
                                const isCheckedIn = ['Checked In', 'In Progress', 'Completed'].includes(visit.visit_status);

                                return (
                                    <div key={visit.visit_instance_id} className={`card p-0 overflow-hidden transition-all duration-200 border-l-4 ${isCheckedIn ? 'border-l-green-500 shadow-sm' : 'border-l-blue-500 hover:shadow-md'}`}>
                                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

                                            {/* Patient Info */}
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0
                                                    ${isCheckedIn ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {visit.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-gray-900 text-lg">{visit.full_name}</h3>
                                                        <span className="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                                                            {visit.trial_patient_id}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <span className="flex items-center gap-1 font-medium text-gray-800">
                                                            <Clock size={14} className="text-gray-400" />
                                                            {visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                                        </span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                                        <span className="font-medium">{visit.visit_name}</span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${visit.visit_window_status === 'On Time' ? 'bg-green-100 text-green-700' :
                                                            visit.visit_window_status === 'Window Closing' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {visit.visit_window_status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="w-full sm:w-auto border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0 mt-2 sm:mt-0 flex justify-end">
                                                {isCheckedIn ? (
                                                    <div className="flex items-center gap-2 text-green-700 font-bold text-sm px-4 py-2 bg-green-50 rounded-lg border border-green-200 w-full sm:w-auto justify-center">
                                                        <CheckCircle size={18} />
                                                        {visit.visit_status}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCheckIn(visit.visit_instance_id)}
                                                        className="btn-primary w-full sm:w-auto shadow-sm"
                                                    >
                                                        Check In Patient
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Right Column - Quick Tools & Alerts */}
                    <div className="space-y-4">
                        <div className="card p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm">
                            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                <UserCheck size={18} /> Pre-Visit Checklist
                            </h3>
                            <ul className="text-sm text-blue-800 space-y-2">
                                <li className="flex gap-2"><CheckCircle size={16} className="text-blue-500 shrink-0 select-none" /> Verify patient identity (ID/DOB)</li>
                                <li className="flex gap-2"><CheckCircle size={16} className="text-blue-500 shrink-0 select-none" /> Confirm ICF is signed and valid</li>
                                <li className="flex gap-2"><CheckCircle size={16} className="text-blue-500 shrink-0 select-none" /> Review concomitant medications</li>
                                <li className="flex gap-2"><CheckCircle size={16} className="text-blue-500 shrink-0 select-none" /> Confirm fasting status if required</li>
                            </ul>
                        </div>

                        <div className="card p-0 overflow-hidden shadow-sm">
                            <div className="bg-amber-50 p-3 border-b border-amber-100 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-amber-600" />
                                <h3 className="font-bold text-amber-900 text-sm">Action Needed</h3>
                            </div>
                            <div className="p-4">
                                <p className="text-sm text-gray-600">No overdue visits requiring immediate rescheduling.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

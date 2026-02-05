import React, { useState, useEffect } from 'react';
import { CalendarCheck, Clock, CheckCircle, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import '../Dashboard.css';

export const PatientCheckIn: React.FC = () => {
    const { user } = useAuth();
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchVisits = async () => {
        if (!user?.site_id) return;
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
        try {
            const response = await fetch(`http://localhost:5000/api/coordinator/visits/checkin?site_id=${user?.site_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visit_instance_id: visitInstanceId })
            });

            if (response.ok) {
                // Refresh list
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

    const checkedInCount = visits.filter(v => v.visit_status === 'Checked In' || v.visit_status === 'Completed').length;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Patient Check-In</h1>
                    <p className="text-gray-500 text-sm">Manage daily patient arrivals</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search patient..."
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <CalendarCheck size={18} />
                        Expected Arrivals (Today)
                    </h3>
                    <div className="text-sm text-gray-500">
                        {checkedInCount}/{visits.length} Checked In
                    </div>
                </div>
                <div className="p-0">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Loading schedules...</div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No visits found matching your search.</div>
                    ) : (
                        filteredVisits.map((visit, index) => {
                            const isCheckedIn = visit.visit_status === 'Checked In' || visit.visit_status === 'Completed';
                            return (
                                <div key={visit.visit_instance_id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-100 ${index === filteredVisits.length - 1 ? 'border-b-0' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                                            ${isCheckedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {visit.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900">{visit.full_name}</h3>
                                                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 rounded">{visit.trial_patient_id}</span>
                                            </div>
                                            <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                                                <span className="flex items-center gap-1 text-gray-600">
                                                    <Clock size={12} /> {visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                                </span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <span>{visit.visit_name}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        {isCheckedIn ? (
                                            <div className="flex items-center gap-2 text-success font-medium text-sm px-4 py-2 bg-green-50 rounded-md border border-green-100">
                                                <CheckCircle size={16} />
                                                <span>{visit.visit_status}</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleCheckIn(visit.visit_instance_id)}
                                                className="btn-primary"
                                            >
                                                Check In
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

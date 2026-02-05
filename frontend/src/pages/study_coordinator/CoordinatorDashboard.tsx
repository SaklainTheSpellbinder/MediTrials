import React, { useState, useEffect } from 'react';
import { CalendarCheck, Users, TestTube, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../Dashboard.css'; // Import the shared dashboard styles

export const CoordinatorDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [todaysVisits, setTodaysVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCoordinatorData = async () => {
            if (!user?.site_id) {
                setLoading(false);
                return;
            }

            try {
                // Fetch Stats
                const statsResponse = await fetch(`http://localhost:5000/api/coordinator/stats?site_id=${user.site_id}`);
                if (statsResponse.ok) {
                    const data = await statsResponse.json();
                    setStats(data);
                }

                // Fetch Today's Visits
                const visitsResponse = await fetch(`http://localhost:5000/api/coordinator/visits/today?site_id=${user.site_id}`);
                if (visitsResponse.ok) {
                    const data = await visitsResponse.json();
                    setTodaysVisits(data);
                }
            } catch (error) {
                console.error("Error fetching coordinator data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCoordinatorData();
    }, [user?.site_id]);

    return (
        <div className="dashboard-container">
            {/* Header Section */}
            <div className="section-header">
                <div>
                    <h1 className="page-title">Welcome back, {user?.full_name || 'Coordinator'}</h1>
                    <p className="text-gray-500 text-sm">Here is your daily summary</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary">View Calendar</button>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <h2 className="text-xl font-bold mb-4 px-1">Quick Actions</h2>
            <div className="stats-grid mb-8">
                <Link to="/checkin" className="card p-6 hover:shadow-md transition group border-l-4 border-l-blue-500 block text-left">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                            <CalendarCheck size={24} />
                        </div>
                        <ArrowRight className="text-gray-300 group-hover:text-blue-500 transition" />
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-gray-800">Patient Check-In</h3>
                    <p className="text-sm text-gray-500">{stats?.today_visits || 0} visits scheduled today</p>
                </Link>

                <Link to="/schedule" className="card p-6 hover:shadow-md transition group border-l-4 border-l-purple-500 block text-left">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition">
                            <Users size={24} />
                        </div>
                        <ArrowRight className="text-gray-300 group-hover:text-purple-500 transition" />
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-gray-800">Schedule Visit</h3>
                    <p className="text-sm text-gray-500">Manage appointments</p>
                </Link>

                <Link to="/labs/entry" className="card p-6 hover:shadow-md transition group border-l-4 border-l-green-500 block text-left">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition">
                            <TestTube size={24} />
                        </div>
                        <ArrowRight className="text-gray-300 group-hover:text-green-500 transition" />
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-gray-800">Enter Lab Results</h3>
                    <p className="text-sm text-gray-500">{stats?.pending_labs || 0} labs pending entry</p>
                </Link>
            </div>

            {/* Dashboard Content Layout */}
            <div className="dashboard-layout">
                {/* Left Column: Tasks */}
                <div className="dash-col-left">
                    <div className="card h-full">
                        <div className="card-header">
                            <h3 className="card-title">
                                Today's Tasks
                            </h3>
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">
                                {((stats?.incomplete_ecrfs || 0) + (stats?.open_queries || 0))} Pending
                            </span>
                        </div>
                        <div className="p-0">
                            {/* Incomplete eCRF Task */}
                            {stats?.incomplete_ecrfs > 0 && (
                                <div className="p-4 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-4 transition">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-800 text-sm">{stats.incomplete_ecrfs} Incomplete eCRFs</h4>
                                        <p className="text-xs text-gray-500 mt-1">Data entry required</p>
                                    </div>
                                    <Link to="/ecrf" className="btn-xs border-blue-200 text-blue-600 hover:bg-blue-50 text-center">Resume</Link>
                                </div>
                            )}

                            {/* Open Queries Task */}
                            {stats?.open_queries > 0 && (
                                <div className="p-4 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-4 transition">
                                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-800 text-sm">{stats.open_queries} Open Data Queries</h4>
                                        <p className="text-xs text-gray-500 mt-1">Monitor attention needed</p>
                                    </div>
                                    <Link to="/ecrf" className="btn-xs border-blue-200 text-blue-600 hover:bg-blue-50 text-center">Resolve</Link>
                                </div>
                            )}

                            {/* Static Fallback Task if empty */}
                            {!stats?.incomplete_ecrfs && !stats?.open_queries && (
                                <div className="p-4 flex items-center justify-center text-gray-400">
                                    No pending tasks found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Schedule */}
                <div className="dash-col-right">
                    <div className="card h-full">
                        <div className="card-header">
                            <h3 className="card-title">
                                <Clock size={18} />
                                Today's Schedule
                            </h3>
                        </div>
                        <div className="p-6">
                            {todaysVisits.length === 0 ? (
                                <p className="text-gray-400 text-center py-4">No visits scheduled for today.</p>
                            ) : (
                                todaysVisits.map((visit: any, index: number) => (
                                    <div key={index} className="flex items-start gap-4 mb-6 last:mb-0">
                                        <div className="flex-none w-14 text-center">
                                            <span className="block text-xs uppercase font-bold text-gray-400 mb-1">Today</span>
                                            {/* Assuming time is not strictly set in mock data yet, using dummy or fetched time if available */}
                                            <span className="block text-lg font-bold text-gray-800">09:00</span>
                                        </div>
                                        <div className={`flex-1 p-3 rounded-lg border relative ${visit.visit_status === 'Completed' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                                            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${visit.visit_status === 'Completed' ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                                            <h4 className={`font-bold pl-2 text-sm ${visit.visit_status === 'Completed' ? 'text-green-900' : 'text-blue-900'}`}>{visit.visit_name}: {visit.full_name}</h4>
                                            <p className={`text-xs pl-2 mt-1 flex items-center gap-1 ${visit.visit_status === 'Completed' ? 'text-green-700' : 'text-blue-700'}`}>
                                                <Clock size={12} /> {visit.visit_status} ({visit.visit_window_status})
                                            </p>
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

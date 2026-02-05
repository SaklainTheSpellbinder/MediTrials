import React from 'react';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    AlertTriangle,
    TestTube,
    BarChart2,
    Lock,
    CalendarCheck
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';
import { SidebarUserSection } from './SidebarUserSection';
import { useAuth } from '../../contexts/AuthContext';

// Define nav items with their allowed roles (if restricted) or default availability
// We'll separate them into logic inside the component or specific lists

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const { user } = useAuth();

    // Default PI / Everyone else items
    const piNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Patient Registry', icon: Users, path: '/patients' },
        { label: 'eCRF Entry', icon: ClipboardList, path: '/ecrf' },
        { label: 'Safety Monitoring', icon: AlertTriangle, path: '/safety' },
        { label: 'Lab Results', icon: TestTube, path: '/labs' },
        { label: 'Statistics', icon: BarChart2, path: '/stats' },
        { label: 'Compliance', icon: Lock, path: '/compliance' },
    ];

    // Study Coordinator specific items
    const coordinatorNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Patient Check-In', icon: CalendarCheck, path: '/checkin' },
        { label: 'Visit Scheduler', icon: Users, path: '/schedule' },
        { label: 'eCRF Entry', icon: ClipboardList, path: '/ecrf' },
        { label: 'Lab Entry', icon: TestTube, path: '/labs/entry' },
        // Removed Mobile AE as requested
    ];

    // Determine which items to show
    const navItems = user?.role === 'Study_Coordinator'
        ? coordinatorNavItems
        : piNavItems;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    🏥 <span className="logo-text">MediTrials</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <SidebarUserSection />
            </div>
        </aside>
    );
};

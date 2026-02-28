import React from 'react';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    AlertTriangle,
    TestTube,
    BarChart2,
    Lock,
    CalendarCheck,
    ClipboardCheck
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';
import { SidebarUserSection } from './SidebarUserSection';

// Define nav items with their allowed roles (if restricted) or default availability
// We'll separate them into logic inside the component or specific lists

interface SidebarProps {
    isCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = () => {
    const location = useLocation();
    const { user } = useAuth();

    const isCoordinator = user?.role === 'Study Coordinator';

    // Default PI / Everyone else items
    const piNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Patient Registry', icon: Users, path: '/patients' },
        { label: 'Screening & Consent', icon: ClipboardCheck, path: '/patients/screening' },
        { label: 'eCRF Entry', icon: ClipboardList, path: '/ecrf' },
        { label: 'Safety Monitoring', icon: AlertTriangle, path: '/safety' },
        { label: 'Lab Results', icon: TestTube, path: '/labs' },
        { label: 'Statistics', icon: BarChart2, path: '/stats' },
        { label: 'Compliance', icon: Lock, path: '/compliance' },
    ];

    const coordinatorNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Patient Registry', icon: Users, path: '/patients' },
        { label: 'Screening & Consent', icon: ClipboardCheck, path: '/patients/screening' },
        { label: 'Visit Management', icon: CalendarCheck, path: '/visits' },
        { label: 'eCRF Entry', icon: ClipboardList, path: '/ecrf' },
        { label: 'Lab Tracking', icon: TestTube, path: '/labs/tracking' },
        { label: 'Safety Reporting', icon: AlertTriangle, path: '/safety' },
    ];

    const navItems = isCoordinator ? coordinatorNavItems : piNavItems;

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

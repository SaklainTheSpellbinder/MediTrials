import React from 'react';
import {
    LayoutDashboard, Users, ClipboardList, AlertTriangle, TestTube,
    BarChart2, Lock, CalendarCheck, ShieldAlert, Activity, FileWarning,
    Siren, Stethoscope, Microscope, FileText, AlertCircle, Database,
    Search, TrendingUp, GitBranch, BookOpen, FlaskConical, 
    //Settings,
    Globe, UserCog,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import './Sidebar.css';
import { SidebarUserSection } from './SidebarUserSection';
import { safetyManagerAPI, dataManagerAPI } from '../../services/api';

interface SidebarProps {
    isCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = () => {
    const location = useLocation();
    const { user } = useAuth();

    // Safety Monitor: critical alert badge
    const { data: smBadge } = useQuery({
        queryKey: ['sm-badge-count'],
        queryFn: async () => {
            const data = await safetyManagerAPI.getSafetyMonitorDashboard();
            return data?.criticalAlerts ?? 0;
        },
        enabled: user?.role === 'Safety_Monitor',
        refetchInterval: 30000, 
        retry: false,
    });
    const alertBadge = smBadge ?? 0;

    // Data Manager: open queries badge (using central API)
    const { data: dmBadge } = useQuery({
        queryKey: ['dm-badge-count'],
        queryFn: async () => {
            const data = await dataManagerAPI.getDashboard();
            return data?.openQueriesTotal ?? 0;
        },
        enabled: user?.role === 'Data_Manager',
        refetchInterval: 60000, 
        retry: false,
    });
    const openQueriesBadge = dmBadge ?? 0;

    // PI nav items
    const piNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Patient Registry', icon: Users, path: '/patients' },
        { label: 'Screening & Consent', icon: ClipboardList, path: '/patients/screening' },
        { label: 'Visit Data Entry', icon: ClipboardList, path: '/ecrf' },
        { label: 'Safety Monitoring', icon: AlertTriangle, path: '/safety' },
        { label: 'Lab Results', icon: TestTube, path: '/labs' },
        // { label: 'Statistics', icon: BarChart2, path: '/stats' },
        // { label: 'Compliance', icon: Lock, path: '/compliance' },
    ];

    // Study Coordinator nav items
    const coordinatorNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Patient Registry', icon: Users, path: '/patients' },
        { label: 'Screening & Consent', icon: ClipboardList, path: '/patients/screening' },
        { label: 'Visit Management', icon: CalendarCheck, path: '/visits' },
        { label: 'Visit Data Entry', icon: ClipboardList, path: '/ecrf' },
        // { label: 'Lab Entry', icon: TestTube, path: '/labs/entry' },
    ];

    // Safety Monitor nav items
    const safetyMonitorNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', badge: 0 },
        { label: 'All Patients', icon: Users, path: '/sm/patients', badge: 0 },
        { label: 'Adverse Events', icon: Activity, path: '/safety/ae', badge: 0 },
        { label: 'SAE Management', icon: FileWarning, path: '/safety/sae', badge: 0 },
        { label: 'Safety Alerts', icon: ShieldAlert, path: '/safety/alerts', badge: alertBadge },
        { label: 'Safety Signals', icon: Siren, path: '/safety/signals', badge: 0 },
        { label: 'DSMB Meetings', icon: Stethoscope, path: '/safety/dsmb', badge: 0 },
        { label: 'Unblinding', icon: Microscope, path: '/safety/unblinding', badge: 0 },
        { label: 'Reports', icon: FileText, path: '/safety/reports', badge: 0 },
    ];

    // Data Manager nav items
    const dataManagerNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Data Queries', icon: AlertCircle, path: '/data-management/queries', badge: openQueriesBadge },
        { label: 'Data Review', icon: Search, path: '/data-management/review' },
        { label: 'Database Lock', icon: Lock, path: '/data-management/lock' },
        { label: 'CDISC Export', icon: Database, path: '/data-management/export' },
        { label: 'Audit Trail', icon: FileText, path: '/audit' },
        { label: 'Protocols', icon: BookOpen, path: '/protocols' },
    ];

    // Statistician nav items
    const statisticianNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Analysis Datasets', icon: Database, path: '/statistics/datasets' },
        { label: 'Survival Analysis', icon: Activity, path: '/statistics/survival' },
        { label: 'Power Analysis', icon: TrendingUp, path: '/statistics/power' },
        { label: 'Randomization Balance', icon: GitBranch, path: '/statistics/balance' },
        { label: 'Safety Statistics', icon: FlaskConical, path: '/statistics/safety' },
        { label: 'Interim Analysis', icon: BarChart2, path: '/statistics/interim' },
        { label: 'CDISC Export', icon: Database, path: '/statistics/export' }, // Fixed path!
    ];

    // Admin nav items
    const adminNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Trial Management', icon: Globe, path: '/admin/trials' },
        { label: 'Site Management', icon: Users, path: '/admin/sites' },
        { label: 'User Management', icon: UserCog, path: '/admin/users' },
        { label: 'Lock Management', icon: Lock, path: '/admin/locks' },
        { label: 'Audit Trail', icon: FileText, path: '/audit' },
        // { label: 'System Settings', icon: Settings, path: '/admin/settings' },
    ];

    const navItems =
        user?.role === 'Study_Coordinator' ? coordinatorNavItems :
            user?.role === 'Safety_Monitor' ? safetyMonitorNavItems :
                user?.role === 'Data_Manager' ? dataManagerNavItems :
                    user?.role === 'Statistician' ? statisticianNavItems :
                        user?.role === 'System_Admin' ? adminNavItems :
                            piNavItems;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                <span className="logo-text">MediTrials</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                    const hasBadge = 'badge' in item && (item as any).badge > 0;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                            {hasBadge && (
                                <span className="nav-badge">{(item as any).badge}</span>
                            )}
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
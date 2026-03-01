import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PIDashboard } from './Principal_Investigator/PIDashboard';
import { CoordinatorDashboard } from './study_coordinator/CoordinatorDashboard';
import { SafetyMonitorDashboard } from './safety_monitor/SafetyMonitorDashboard';
import { DataManagerDashboard } from './DataManagerDashboard/DataManagerDashboard';
import { StatisticianDashboard } from './StatisticianDashboard/StatisticianDashboard';
import { AdminDashboard } from './admin/AdminDashboard';

export const Dashboard: React.FC = () => {
    const { user } = useAuth();

    if (user?.role === 'Study_Coordinator') return <CoordinatorDashboard />;
    if (user?.role === 'Safety_Monitor') return <SafetyMonitorDashboard />;
    if (user?.role === 'Data_Manager') return <DataManagerDashboard />;
    if (user?.role === 'Statistician') return <StatisticianDashboard />;
    if (user?.role === 'System_Admin') return <AdminDashboard />;

    // Default: PI dashboard
    return <PIDashboard />;
};

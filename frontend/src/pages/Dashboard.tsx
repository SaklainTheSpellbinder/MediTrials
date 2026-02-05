import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PIDashboard } from './Principal_Investigator/PIDashboard';
import { CoordinatorDashboard } from './study_coordinator/CoordinatorDashboard';

export const Dashboard: React.FC = () => {
    const { user } = useAuth();

    if (user?.role === 'Study_Coordinator') {
        return <CoordinatorDashboard />;
    }

    // Default to PI dashboard for PI and all other roles (Safety Monitor, etc)
    return <PIDashboard />;
};

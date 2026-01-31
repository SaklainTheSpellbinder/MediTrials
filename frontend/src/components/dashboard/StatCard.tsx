import React from 'react';
import type { LucideIcon } from 'lucide-react';
import './StatCard.css';

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    trend?: 'up' | 'down' | 'neutral';
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    subValue,
    icon: Icon,
    color = 'primary'
}) => {
    return (
        <div className={`stat-card border-${color}`}>
            <div className="stat-content">
                <p className="stat-label">{label}</p>
                <h3 className="stat-value">{value}</h3>
                {subValue && <span className="stat-sub">{subValue}</span>}
            </div>
            <div className={`stat-icon bg-${color}-light`}>
                <Icon className={`text-${color}`} size={24} />
            </div>
        </div>
    );
};

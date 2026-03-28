import React from 'react';

interface Props { level: string; size?: 'sm' | 'md'; }

const config: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: '#FEE2E2', color: '#991B1B' },
    SEVERE: { bg: '#FFEDD5', color: '#9A3412' },
    WARNING: { bg: '#FEF9C3', color: '#854D0E' },
    INFO: { bg: '#DBEAFE', color: '#1E40AF' },
    HIGH: { bg: '#FFEDD5', color: '#9A3412' },
    MEDIUM: { bg: '#FEF9C3', color: '#854D0E' },
    LOW: { bg: '#DBEAFE', color: '#1E40AF' },
};

export const SeverityBadge: React.FC<Props> = ({ level, size = 'sm' }) => {
    const cfg = config[level?.toUpperCase()] ?? config.INFO;
    return (
        <span style={{
            background: cfg.bg, color: cfg.color,
            padding: size === 'md' ? '3px 10px' : '2px 7px',
            borderRadius: '9999px',
            fontSize: size === 'md' ? '0.75rem' : '0.65rem',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
        }}>
            {level}
        </span>
    );
};

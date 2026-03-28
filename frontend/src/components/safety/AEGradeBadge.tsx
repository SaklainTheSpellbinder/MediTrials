import React from 'react';

interface Props { grade: number; }

const gradeConfig: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: '#DBEAFE', color: '#1D4ED8', label: 'G1' },
    2: { bg: '#CCFBF1', color: '#0F766E', label: 'G2' },
    3: { bg: '#FEF9C3', color: '#A16207', label: 'G3' },
    4: { bg: '#FFEDD5', color: '#C2410C', label: 'G4' },
    5: { bg: '#FEE2E2', color: '#991B1B', label: 'G5' },
};

export const AEGradeBadge: React.FC<Props> = ({ grade }) => {
    const cfg = gradeConfig[grade] ?? gradeConfig[1];
    return (
        <span style={{
            background: cfg.bg, color: cfg.color,
            padding: '2px 8px', borderRadius: '4px',
            fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
        }}>
            {cfg.label}
        </span>
    );
};

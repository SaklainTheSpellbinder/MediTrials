import React from 'react';
import '../Dashboard.css';

export const SafetySignals: React.FC = () => (
    <div className="dashboard-container">
        <div className="section-header">
            <h1 className="page-title">Safety Signals</h1>
        </div>
        <div className="card p-8 text-center text-gray-400">
            <p className="text-lg font-semibold mb-2">Under development — Sprint 4</p>
            <p className="text-sm">PRR-based signal detection across all trials via sp_detect_safety_signals.</p>
        </div>
    </div>
);

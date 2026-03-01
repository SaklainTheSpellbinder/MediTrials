import React from 'react';
import '../Dashboard.css';

export const AdverseEvents: React.FC = () => (
    <div className="dashboard-container">
        <div className="section-header">
            <h1 className="page-title">Adverse Events</h1>
        </div>
        <div className="card p-8 text-center text-gray-400">
            <p className="text-lg font-semibold mb-2">Under development — Sprint 4</p>
            <p className="text-sm">Full AE list with grade/causality filters across all trials.</p>
        </div>
    </div>
);

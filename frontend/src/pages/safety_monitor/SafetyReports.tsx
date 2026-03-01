import React from 'react';
import '../Dashboard.css';

export const SafetyReports: React.FC = () => (
    <div className="dashboard-container">
        <div className="section-header">
            <h1 className="page-title">Safety Reports</h1>
        </div>
        <div className="card p-8 text-center text-gray-400">
            <p className="text-lg font-semibold mb-2">Under development — Sprint 4</p>
            <p className="text-sm">Generate safety snapshots via sp_generate_safety_report with cutoff date.</p>
        </div>
    </div>
);

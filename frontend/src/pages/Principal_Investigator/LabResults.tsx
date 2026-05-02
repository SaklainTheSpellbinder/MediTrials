import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, TestTube, AlertTriangle, Clock, X, ChevronDown } from 'lucide-react';
import { labAPI, piSafetyAPI } from '../../services/api';
import './LabResults.css';

// --- Interfaces ---
interface LabResult {
    result_id: number;
    trial_patient_id: string;
    full_name: string;
    test_name: string;
    result_value: number;
    result_date: string;
    result_status: string;
    critical_result_flag: boolean;
    reference_range_text: string;
    unit_of_measure: string;
    range_flag: 'High' | 'Low' | 'Normal';
}

interface PatientOption {
    patient_id: number;
    trial_patient_id: string;
    full_name: string;
}

export const LabResults: React.FC = () => {
    const qc = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Critical'>('All');
    const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('');
    const [selectedLab, setSelectedLab] = useState<LabResult | null>(null);

    // Fetch enrolled patients for the dropdown (site_id comes from JWT on backend)
    const { data: patients = [] } = useQuery<PatientOption[]>({
        queryKey: ['pi-lab-patients'],
        queryFn: () => piSafetyAPI.getPatients(),
    });

    const { data: labData, isLoading } = useQuery({
        queryKey: ['pi-site-labs', selectedPatientId],
        queryFn: () => labAPI.getSiteLabs(selectedPatientId || undefined),
    });

    const labs: LabResult[] = labData?.labs ?? [];

    
    const reviewMut = useMutation({
        mutationFn: (resultId: number) => labAPI.review(resultId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pi-site-labs'] });
            setSelectedLab(null);
        },
    });

    const handleReviewSign = () => {
        if (!selectedLab) return;
        reviewMut.mutate(selectedLab.result_id);
    };

    const filteredLabs = labs.filter((lab) => {
        const matchesSearch =
            lab.trial_patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (lab.full_name && lab.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            lab.test_name.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesTab = true;
        if (activeTab === 'Pending') {
            matchesTab = lab.result_status === 'Pending';
        } else if (activeTab === 'Critical') {
            matchesTab = lab.critical_result_flag || lab.range_flag !== 'Normal';
        }

        return matchesSearch && matchesTab;
    });

    const pendingCount = labs.filter(l => l.result_status === 'Pending').length;
    const criticalCount = labs.filter(l => l.critical_result_flag).length;

    return (
        <div className="lab-results-container">
            <div className="labs-header">
                <div>
                    <h1 className="labs-title">Laboratory Results</h1>
                    <p className="text-gray-500 text-sm">Review clinical laboratory test results for patients at your site.</p>
                </div>

                <div className="labs-tabs">
                    <button className={`lab-tab ${activeTab === 'All' ? 'active' : ''}`} onClick={() => setActiveTab('All')}>
                        All Results ({labs.length})
                    </button>
                    <button className={`lab-tab ${activeTab === 'Pending' ? 'active' : ''}`} onClick={() => setActiveTab('Pending')}>
                        Pending Review ({pendingCount})
                    </button>
                    <button className={`lab-tab ${activeTab === 'Critical' ? 'active' : ''}`} onClick={() => setActiveTab('Critical')}>
                        Critical / Abnormal ({labs.filter(l => l.critical_result_flag || l.range_flag !== 'Normal').length})
                    </button>
                </div>
            </div>

            {/* KPI Overview */}
            <div className="labs-overview">
                <div className="lab-stat-card">
                    <div className="lab-stat-icon primary"><TestTube size={24} /></div>
                    <div className="lab-stat-info"><h3>Total Reports</h3><p>{labs.length}</p></div>
                </div>
                <div className="lab-stat-card">
                    <div className="lab-stat-icon warning"><Clock size={24} /></div>
                    <div className="lab-stat-info"><h3>Pending Review</h3><p>{pendingCount}</p></div>
                </div>
                <div className="lab-stat-card">
                    <div className="lab-stat-icon danger"><AlertTriangle size={24} /></div>
                    <div className="lab-stat-info"><h3>Critical Flags</h3><p>{criticalCount}</p></div>
                </div>
            </div>

            {/* Main Wrapper */}
            <div className="labs-card">
                <div className="labs-toolbar">
                    {/* Patient filter dropdown (fetched from backend via piSafetyAPI) */}
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                        <select
                            id="patient-filter-dropdown"
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value ? parseInt(e.target.value) : '')}
                            style={{
                                appearance: 'none', width: '100%',
                                padding: '0.6rem 2.5rem 0.6rem 1rem',
                                border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                                background: 'white', fontSize: '0.875rem',
                                color: selectedPatientId ? '#111827' : '#6b7280',
                                cursor: 'pointer', fontWeight: selectedPatientId ? 600 : 400,
                            }}
                        >
                            <option value="">All Patients</option>
                            {patients.map(p => (
                                <option key={p.patient_id} value={p.patient_id}>
                                    {p.trial_patient_id}{p.full_name ? ` — ${p.full_name}` : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                    </div>

                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search tests, patients, or IDs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {selectedPatientId && (
                        <button
                            onClick={() => setSelectedPatientId('')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer' }}
                        >
                            <X size={14} /> Clear Filter
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="labs-table">
                        <thead>
                            <tr>
                                <th>Result Date</th>
                                <th>Subject ID</th>
                                <th>Test Name</th>
                                <th>Result</th>
                                <th>Range Flag</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading laboratory results...</td></tr>
                            ) : filteredLabs.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-gray-500">
                                    {selectedPatientId ? 'No lab results found for the selected patient.' : 'No lab results found.'}
                                </td></tr>
                            ) : (
                                filteredLabs.map((lab) => (
                                    <tr key={lab.result_id}>
                                        <td className="text-gray-600">{new Date(lab.result_date).toLocaleDateString()}</td>
                                        <td>
                                            <div className="patient-info">
                                                <span className="patient-id">{lab.trial_patient_id}</span>
                                                <span className="patient-name">{lab.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="font-medium text-gray-700">
                                            {lab.test_name}
                                            {lab.critical_result_flag && <span className="critical-badge">CRITICAL</span>}
                                        </td>
                                        <td>
                                            <div className="result-value-col">
                                                {lab.result_value !== null ? `${lab.result_value} ${lab.unit_of_measure.replace('uL', 'µL')}` : 'N/A'}
                                            </div>
                                            <div className="reference-range">
                                                Ref: {lab.reference_range_text} {lab.unit_of_measure.replace('uL', 'µL')}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`range-indicator range-${lab.range_flag.toLowerCase()}`}>
                                                {lab.range_flag}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${lab.result_status === 'Completed' ? 'success' : 'warning'}`}>
                                                {lab.result_status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={`action-btn ${lab.critical_result_flag ? 'urgent' : ''}`}
                                                onClick={() => setSelectedLab(lab)}
                                            >
                                                {lab.result_status === 'Pending' ? 'Review & Sign' : 'View Details'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail / Sign-off Modal */}
            {selectedLab && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">
                                {selectedLab.result_status === 'Pending' ? 'Review Lab Result' : 'Lab Result Details'}
                            </h2>
                            <button onClick={() => setSelectedLab(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-1">Patient</p>
                                <p className="font-semibold">{selectedLab.trial_patient_id} - {selectedLab.full_name}</p>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-gray-700">{selectedLab.test_name}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedLab.range_flag === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {selectedLab.range_flag}
                                    </span>
                                </div>
                                <div className="text-2xl font-bold font-mono text-gray-900">
                                    {selectedLab.result_value} <span className="text-sm font-normal text-gray-500">{selectedLab.unit_of_measure.replace('uL', 'µL')}</span>
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    Ref: {selectedLab.reference_range_text} {selectedLab.unit_of_measure.replace('uL', 'µL')}
                                </div>
                            </div>

                            {selectedLab.result_status === 'Pending' && (
                                <div className="bg-blue-50/50 p-4 rounded border border-blue-100 mb-6">
                                    <p className="text-sm text-blue-800">
                                        By signing off, you confirm that you have clinically reviewed this lab result and it requires no further immediate medical intervention.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end mt-4">
                                <button onClick={() => setSelectedLab(null)} className="btn-secondary px-4 py-2 text-sm font-medium">
                                    Close
                                </button>
                                {selectedLab.result_status === 'Pending' && (
                                    <button
                                        onClick={handleReviewSign}
                                        disabled={reviewMut.isPending}
                                        className="btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
                                    >
                                        {reviewMut.isPending ? 'Signing...' : 'Sign & Complete'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

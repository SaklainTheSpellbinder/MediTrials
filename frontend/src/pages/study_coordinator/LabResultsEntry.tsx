import React, { useState, useEffect } from 'react';
import { TestTube, Save, FileSpreadsheet, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../Dashboard.css';

export const LabResultsEntry: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pendingLabs, setPendingLabs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLab, setSelectedLab] = useState<any | null>(null);
    const [resultValue, setResultValue] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Fetch Pending Labs
    const fetchPendingLabs = async () => {
        if (!user?.site_id) return;
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:5000/api/coordinator/labs/pending?site_id=${user.site_id}`);
            if (response.ok) {
                const data = await response.json();
                setPendingLabs(data);
            }
        } catch (error) {
            console.error("Error fetching labs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingLabs();
    }, [user?.site_id]);

    // Handle Save
    const handleSave = async () => {
        if (!selectedLab || !resultValue) return;

        setSubmitting(true);
        try {
            const response = await fetch(`http://localhost:5000/api/coordinator/labs/update?site_id=${user?.site_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    result_id: selectedLab.result_id,
                    result_value: parseFloat(resultValue)
                })
            });

            if (response.ok) {
                // Refresh list and close modal
                await fetchPendingLabs();
                setSelectedLab(null);
                setResultValue('');
            } else {
                alert("Failed to save result");
            }
        } catch (error) {
            console.error("Error updating lab:", error);
            alert("Error saving result");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="section-header">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="back-button">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title">Lab Results Entry</h1>
                        <p className="text-gray-500 text-sm">Worklist for pending laboratory data</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <TestTube size={18} className="text-primary" />
                        Pending Results ({pendingLabs.length})
                    </h3>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Loading pending labs...</div>
                    ) : pendingLabs.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No pending lab results found. Great job!</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {pendingLabs.map((lab) => (
                                <div key={lab.result_id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                            {lab.test_name.substring(0, 3).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">{lab.test_name}</h4>
                                            <p className="text-sm text-gray-500">
                                                {lab.full_name} ({lab.trial_patient_id}) - {lab.visit_name}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        className="btn-primary btn-sm"
                                        onClick={() => {
                                            setSelectedLab(lab);
                                            setResultValue('');
                                        }}
                                    >
                                        Enter Result
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal (Simple Inline Overlay for now) */}
            {selectedLab && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Enter Value</h3>
                            <button onClick={() => setSelectedLab(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="bg-gray-50 p-3 rounded-lg mb-4">
                                <p className="text-xs text-gray-500 uppercase font-bold">Test</p>
                                <p className="font-medium">{selectedLab.test_name}</p>
                                <p className="text-xs text-gray-500 uppercase font-bold mt-2">Patient</p>
                                <p className="font-medium">{selectedLab.full_name} ({selectedLab.trial_patient_id})</p>
                            </div>

                            <label className="form-label">Result Value</label>
                            <input
                                type="number"
                                className="form-input text-lg"
                                autoFocus
                                placeholder="Enter value..."
                                value={resultValue}
                                onChange={(e) => setResultValue(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button className="btn-secondary" onClick={() => setSelectedLab(null)}>Cancel</button>
                            <button
                                className="btn-primary"
                                onClick={handleSave}
                                disabled={!resultValue || submitting}
                            >
                                {submitting ? 'Saving...' : 'Save Result'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

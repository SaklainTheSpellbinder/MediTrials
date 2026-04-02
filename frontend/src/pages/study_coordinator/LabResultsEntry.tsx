import React, { useState, useEffect } from 'react';
import { TestTube, X, ArrowLeft, ArrowRight, ClipboardList, Thermometer, UserSquare2, ChevronRight, Droplet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Coordinator.css';

export const LabResultsEntry: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pendingLabs, setPendingLabs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLab, setSelectedLab] = useState<any | null>(null);
    const [resultValue, setResultValue] = useState('');
    const [submitting, setSubmitting] = useState(false);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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
                await fetchPendingLabs();
                setSelectedLab(null);
                setResultValue('');
            } else {
                console.error("Failed to save result");
            }
        } catch (error) {
            console.error("Error updating lab:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            setSelectedLab(null);
        }
    };

    return (
        <div className="coord-container" style={{ maxWidth: '1000px', position: 'relative' }}>
            
            {/* Header */}
            <div className="coord-flex-row-between" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    <button 
                        onClick={() => navigate(-1)} 
                        className="coord-action-icon" style={{ width: '2.75rem', height: '2.75rem', background: '#ffffff', border: '1px solid #e5e7eb', color: '#4b5563', cursor: 'pointer', marginBottom: 0 }}
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <div className="coord-badge coord-badge-teal" style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Thermometer size={12} strokeWidth={3} /> Clinical Data Entry
                        </div>
                        <h1 className="coord-page-title">Lab Results Entry</h1>
                        <p className="coord-page-subtitle">Process pending laboratory workloads efficiently.</p>
                    </div>
                </div>
                
                <div style={{ background: '#ffffff', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#10b981' }}></div>
                    <span style={{ fontWeight: 800, color: '#1f2937' }}>{pendingLabs.length} <span style={{ color: '#6b7280', fontWeight: 500 }}>Pending</span></span>
                </div>
            </div>

            {/* List Content Area */}
            <div className="coord-content-card" style={{ overflow: 'visible' }}>
                <div className="coord-card-header">
                    <h3>
                        <div style={{ background: 'linear-gradient(135deg, #0d9488, #059669)', padding: '0.5rem', borderRadius: '0.5rem', color: 'white', display: 'flex' }}>
                            <TestTube size={20} />
                        </div>
                        Central Queue
                    </h3>
                </div>

                <div className="coord-card-body no-padding" style={{ minHeight: '400px' }}>
                    {loading ? (
                        <div className="coord-empty-state">
                            <div className="coord-spinner" style={{ width: '3rem', height: '3rem', color: '#0d9488', borderWidth: '4px', marginBottom: '1rem' }}></div>
                            <p style={{ fontWeight: 700, color: '#4b5563' }}>Querying central database...</p>
                        </div>
                    ) : pendingLabs.length === 0 ? (
                        <div className="coord-empty-state">
                            <div className="coord-empty-icon" style={{ width: '6rem', height: '6rem' }}>
                                <ClipboardList size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1f2937', margin: '0 0 0.5rem 0' }}>Queue is empty!</h3>
                            <p style={{ maxWidth: '300px' }}>All laboratory specimens have been documented for your site. Great job!</p>
                        </div>
                    ) : (
                        <div style={{ padding: '0.5rem' }}>
                            {pendingLabs.map((lab) => (
                                <div key={lab.result_id} className="coord-action-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '1.25rem', gap: '1.5rem' }}>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: '#f0fdfa', border: '1px solid #ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488', fontWeight: 800, fontSize: '1.125rem' }}>
                                            {lab.test_name.substring(0, 3).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, fontSize: '1.125rem', color: '#111827' }}>{lab.test_name}</h4>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                <span className="coord-badge coord-badge-gray">
                                                    <UserSquare2 size={14} /> {lab.full_name || lab.trial_patient_id}
                                                </span>
                                                <span className="coord-badge" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                                                    {lab.trial_patient_id}
                                                </span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2dd4bf' }}></span>
                                                    {lab.visit_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setSelectedLab(lab);
                                            setResultValue('');
                                        }}
                                        className="coord-btn-outline"
                                        style={{ border: '2px solid #e5e7eb', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white' }}
                                    >
                                        Log Result <ChevronRight size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Pure CSS Glassmorphic Modal overlay */}
            {selectedLab && (
                <div className="coord-modal-backdrop" onClick={handleBackdropClick}>
                    <div className="coord-modal" onClick={e => e.stopPropagation()}>
                        <div className="coord-modal-header">
                            <h3><Droplet size={20} strokeWidth={2.5} /> Enter Result Value</h3>
                            <button className="coord-modal-close" onClick={() => setSelectedLab(null)}>
                                <X size={18} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="coord-modal-body">
                            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: '0.7rem', color: '#0d9488', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', margin: '0 0 0.25rem 0' }}>Target Test</p>
                                <p style={{ fontWeight: 800, color: '#111827', fontSize: '1.125rem', margin: '0 0 1rem 0' }}>{selectedLab.test_name}</p>
                                
                                <p style={{ fontSize: '0.7rem', color: '#0d9488', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', margin: '0 0 0.5rem 0' }}>Subject Profile</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#4b5563' }}>
                                        {selectedLab.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{selectedLab.full_name || selectedLab.trial_patient_id}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>{selectedLab.trial_patient_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, color: '#374151', marginBottom: '0.5rem' }}>Numeric Result Value</label>
                                <input
                                    type="number"
                                    className="coord-input-field"
                                    autoFocus
                                    step="any"
                                    placeholder="0.0"
                                    value={resultValue}
                                    onChange={(e) => setResultValue(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                                <button type="button" className="coord-btn-outline" style={{ flex: 1, padding: '0.75rem', fontWeight: 800, background: 'white' }} onClick={() => setSelectedLab(null)}>Cancel</button>
                                <button type="submit" disabled={!resultValue || submitting} className="coord-btn-primary" style={{ flex: 1, padding: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    {submitting ? (
                                        <><div className="coord-spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></div> Saving</>
                                    ) : (
                                        <>Save Profile <ArrowRight size={16} strokeWidth={2.5}/></>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

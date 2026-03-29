import React, { useState, useEffect } from 'react';
import { ClipboardList, ArrowRight, User, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { screeningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import '../../pages/Dashboard.css';

export const PendingScreeningsWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPending = async () => {
            if (!user?.site_id) {
                setLoading(false);
                return;
            }
            try {
                const data = await screeningAPI.getPendingPiReview(user.site_id);
                if (data.success && Array.isArray(data.patients)) {
                    setPending(data.patients);
                }
            } catch (err) {
                console.error('Failed to fetch pending screenings', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPending();
    }, [user?.site_id]);

    const calcAge = (dob: string) => {
        try {
            return new Date().getFullYear() - new Date(dob).getFullYear();
        } catch { return '—'; }
    };

    if (loading) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <ClipboardList size={18} /> Pending PI Reviews
                    </h3>
                </div>
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
                    <div className="animate-spin" style={{ width: 24, height: 24, border: '3px solid var(--gray-200)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 8px' }} />
                    Loading…
                </div>
            </div>
        );
    }

    if (pending.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <ClipboardList size={18} /> Pending PI Reviews
                    </h3>
                </div>
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-500)', fontWeight: 500 }}>
                    No screenings pending your review.
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">
                    <ClipboardList size={18} /> Pending PI Reviews ({pending.length})
                </h3>
            </div>
            <div className="alert-list">
                {pending.map(p => (
                    <div className="alert-item high" key={p.patient_id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="alert-content" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: '#eef2ff', color: '#4f46e5',
                            }}>
                                <User size={16} />
                            </div>
                            <div>
                                <span style={{ fontWeight: 700 }}>{p.full_name || p.trial_patient_id}</span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginLeft: 8 }}>
                                    ({p.gender}, Age: {calcAge(p.date_of_birth)})
                                </span>
                                <p style={{ color: 'var(--gray-400)', fontSize: '0.72rem', marginTop: 2 }}>
                                    {p.enrollment_date
                                        ? `Enrolled: ${new Date(p.enrollment_date).toLocaleDateString()}`
                                        : 'Awaiting PI action'}
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => navigate(`/patients/screening/${p.patient_id}`)}>
                            Review <ArrowRight size={13} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

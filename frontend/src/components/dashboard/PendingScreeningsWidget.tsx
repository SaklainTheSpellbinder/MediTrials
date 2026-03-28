import React, { useState, useEffect } from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
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
    },[user?.site_id]);

    if (loading) {
        return <div className="p-4 text-center text-gray-500">Loading pending reviews...</div>;
    }

    if (pending.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <ClipboardList size={18} /> Pending PI Reviews
                    </h3>
                </div>
                <div className="p-4 text-center text-gray-500 font-medium">
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
                    <div className="alert-item high" key={p.patient_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="alert-content">
                            <span className="font-bold">{p.trial_patient_id}</span>
                            <span className="text-sm text-gray-600 ml-2">({p.gender}, Age: {new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()})</span>
                            <p className="text-gray-500 text-xs mt-1">
                                {p.enrollment_date
                                    ? `Enrolled: ${new Date(p.enrollment_date).toLocaleDateString()}`
                                    : 'Awaiting PI action'}
                            </p>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => navigate(`/patients/screening/${p.patient_id}`)}>
                            Review <ArrowRight size={14} className="ml-1 inline" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

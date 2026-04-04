import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { adminAPI } from '../../services/api';
import '../Dashboard.css';

export const SiteEdit: React.FC = () => {
    const { siteId } = useParams<{ siteId: string }>();
    const navigate = useNavigate();
    const qc = useQueryClient();

    // Added site_status back to state
    const [form, setForm] = useState({
        country: '',
        target_enrollment: 0,
        site_status: 'Initiated',
    });

    // Fetch existing site data
    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'site', siteId],
        queryFn: () => adminAPI.getSiteDetails(siteId!),
        enabled: !!siteId,
    });

    // Populate form when data loads
    useEffect(() => {
        if (data?.site) {
            setForm({
                country: data.site.country || '',
                target_enrollment: data.enrollment?.target_enrollment || 0,
                site_status: data.site.site_status || 'Initiated',
            });
        }
    }, [data]);

    // Mutation to save changes 
    const updateMut = useMutation({
        mutationFn: (payload: any) => adminAPI.updateSite(siteId!, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin', 'site', siteId] });
            qc.invalidateQueries({ queryKey: ['admin', 'sites'] });
            navigate(`/admin/sites/${siteId}`); // Go back to details page
        },
    });

    if (isLoading) return <div className="dashboard-container"><div className="sm-loading">Loading site data…</div></div>;

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <button className="back-btn" onClick={() => navigate(`/admin/sites/${siteId}`)}>
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="page-title">Edit Site #{siteId}</h1>
                    <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Update site country, status, and enrollment targets.</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 600 }}>
                <div style={{ display: 'grid', gap: 16 }}>
                    
                    {/* READ-ONLY FIELD: Institution Name */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Lock size={12} color="#9CA3AF" /> Institution Name
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={data?.site?.institution_name || ''}
                            disabled
                            style={{ background: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
                        />
                    </div>

                    {/* EDITABLE FIELD: Country */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Country *</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={form.country}
                            onChange={e => setForm({ ...form, country: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        
                        {/* EDITABLE FIELD: Site Status */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Site Status *</label>
                            <select 
                                className="form-select" 
                                value={form.site_status}
                                onChange={e => setForm({ ...form, site_status: e.target.value })}
                            >
                                <option value="Initiated">Initiated</option>
                                <option value="Active">Active</option>
                                <option value="Suspended">Suspended</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>

                        {/* EDITABLE FIELD: Target Enrollment */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Target Enrollment *</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={form.target_enrollment}
                                onChange={e => setForm({ ...form, target_enrollment: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => updateMut.mutate(form)}
                        disabled={updateMut.isPending || !form.country}
                    >
                        <Save size={14} style={{ marginRight: 6 }} /> 
                        {updateMut.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button className="btn-secondary" onClick={() => navigate(`/admin/sites/${siteId}`)}>
                        Cancel
                    </button>
                </div>
                
                {updateMut.isError && (
                    <div style={{ marginTop: 16, color: '#DC2626', fontSize: 13 }}>
                        Failed to update site. Please check your connection.
                    </div>
                )}
            </div>
        </div>
    );
};
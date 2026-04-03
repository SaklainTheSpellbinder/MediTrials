import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { RefreshCw, Check } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';

const adminApi = axios.create({ 
    baseURL: 'http://localhost:5000',
    withCredentials: true, // Include httpOnly cookie
});
// No need to set X-User-Data header; auth is via httpOnly cookie

const ROLES_ALL = ['Principal_Investigator', 'Study_Coordinator', 'Safety_Monitor', 'Data_Manager', 'Statistician', 'System_Admin'];

const defaults: Record<string, any> = {
    session_timeout_minutes: 60,
    max_failed_logins: 5,
    password_min_length: 8,
    mfa_required_roles: [],
    notifications: {},
    mv_refresh_interval_hours: 24,
};

const getV = (settings: any[], key: string) => {
    const found = settings.find((s: any) => s.key === key);
    return found ? found.value : defaults[key];
};

export const SystemSettings: React.FC = () => {
    const qc = useQueryClient();
    const [saved, setSaved] = useState<Record<string, boolean>>({});

    const { data: settings = [], isLoading } = useQuery({
        queryKey: ['admin', 'settings'],
        queryFn: () => adminApi.get('/api/admin/settings').then(r => r.data),
    });

    const refresh = useMutation({
        mutationFn: () => adminApi.post('/api/admin/mv/refresh'),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); setSaved(s => ({ ...s, mv: true })); setTimeout(() => setSaved(s => ({ ...s, mv: false })), 2000); },
    });

    const saveSetting = async (key: string, value: any) => {
        await adminApi.put('/api/admin/settings', { key, value });
        qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
        setSaved(s => ({ ...s, [key]: true }));
        setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
    };

    const NumField = ({ label, k, min = 1 }: { label: string; k: string; min?: number }) => {
        const [val, setVal] = useState<number>(getV(settings, k));
        React.useEffect(() => { setVal(getV(settings, k)); }, [settings]);
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" value={val} min={min} onChange={e => setVal(parseInt(e.target.value))}
                        style={{ width: 70, border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', fontSize: 13, textAlign: 'center' }} />
                    <button onClick={() => saveSetting(k, val)} className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>
                        {saved[k] ? <><Check size={11} /> Saved</> : 'Save'}
                    </button>
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="dashboard-container"><div className="sm-loading">Loading settings…</div></div>;

    const mfaRoles: string[] = getV(settings, 'mfa_required_roles') ?? [];

    return (
        <div className="dashboard-container">
            <div className="section-header"><h1 className="page-title">System Settings</h1></div>

            {/* Section 1 — Safety Signals */}
            <div className="card" style={{ marginBottom: 14 }}>
                <h3 className="card-title">Safety Signal Detection</h3>
                <div style={{ background: '#FEF3C7', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                    ℹ️ Safety signal threshold is currently hardcoded: trigger fires when same AE term appears &gt;5 times in 24 hours. Changing this requires a database trigger update.
                </div>
            </div>

            {/* Section 2 — Session & Security */}
            <div className="card" style={{ marginBottom: 14 }}>
                <h3 className="card-title">Session &amp; Security</h3>
                <NumField label="Session timeout (minutes)" k="session_timeout_minutes" />
                <NumField label="Max failed login attempts before lockout" k="max_failed_logins" />
                <NumField label="Password minimum length" k="password_min_length" min={6} />
                <div style={{ padding: '12px 0' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Enforce MFA for roles:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {ROLES_ALL.map(role => (
                            <label key={role} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                                <input type="checkbox" checked={mfaRoles.includes(role)}
                                    onChange={e => {
                                        const next = e.target.checked ? [...mfaRoles, role] : mfaRoles.filter((r: string) => r !== role);
                                        saveSetting('mfa_required_roles', next);
                                    }} />
                                {role.replace(/_/g, ' ')}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section 3 — Notifications */}
            <div className="card" style={{ marginBottom: 14 }}>
                <h3 className="card-title">Notification Routing</h3>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Select which roles receive email notifications for each event type.</p>
                {['Critical Lab Result', 'SAE Filed', 'Safety Signal Detected', 'Protocol Deviation'].map(event => {
                    const notifKey = `notify_${event.replace(/\s+/g, '_').toLowerCase()}`;
                    const selected: string[] = getV(settings, notifKey) ?? [];
                    return (
                        <div key={event} style={{ marginBottom: 12 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{event}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {ROLES_ALL.map(role => (
                                    <label key={role} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12 }}>
                                        <input type="checkbox" checked={selected.includes(role)}
                                            onChange={e => {
                                                const next = e.target.checked ? [...selected, role] : selected.filter((r: string) => r !== role);
                                                saveSetting(notifKey, next);
                                            }} />
                                        {role.replace(/_/g, ' ')}
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Section 4 — Materialized Views */}
            <div className="card">
                <h3 className="card-title">Materialized Views</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>Manual refresh</span>
                    <button onClick={() => refresh.mutate()} disabled={refresh.isPending} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={13} className={refresh.isPending ? 'sm-spin' : ''} />
                        {saved.mv ? <><Check size={12} /> Refreshed!</> : refresh.isPending ? 'Refreshing…' : 'Refresh Now'}
                    </button>
                </div>
                <NumField label="Auto-refresh interval (hours)" k="mv_refresh_interval_hours" />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>MVs are also automatically refreshed after every trial, site, or user create/edit operation.</p>
            </div>
        </div>
    );
};

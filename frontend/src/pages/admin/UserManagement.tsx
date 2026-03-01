import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import '../Dashboard.css';
import '../admin/AdminDashboard.css';

const adminApi = axios.create({ baseURL: 'http://localhost:5000' });
adminApi.interceptors.request.use(cfg => { const raw = localStorage.getItem('user'); if (raw) cfg.headers['X-User-Data'] = btoa(raw); return cfg; });

const ROLES = ['Principal_Investigator', 'Study_Coordinator', 'Safety_Monitor', 'Data_Manager', 'Statistician', 'System_Admin'];
const ROLE_NEEDS_SITE = (r: string) => ['Principal_Investigator', 'Study_Coordinator'].includes(r);

const empty = { username: '', email: '', role: 'Study_Coordinator', site_id: '', password: '', mfa_enabled: false, is_active: true };

const SlideOver: React.FC<{ initial?: any; onClose: () => void; sites: any[] }> = ({ initial, onClose, sites }) => {
    const qc = useQueryClient();
    const [form, setForm] = useState({ ...empty, ...initial });
    const [err, setErr] = useState('');
    const isEdit = !!initial?.user_id;

    const save = useMutation({
        mutationFn: () => {
            const body = { ...form, site_id: ROLE_NEEDS_SITE(form.role) ? (form.site_id || null) : null };
            return isEdit
                ? adminApi.put(`/api/admin/users/${initial.user_id}`, body).then(r => r.data)
                : adminApi.post('/api/admin/users', body).then(r => r.data);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); onClose(); },
        onError: (e: any) => setErr(e.response?.data?.error ?? e.message),
    });

    const F = (label: string, name: keyof typeof form, type = 'text', child?: React.ReactNode) => (
        <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>{label}</label>
            {child || <input type={type} value={form[name] as string} onChange={e => setForm((f: any) => ({ ...f, [name]: e.target.value }))}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} />}
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex' }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />
            <div className="card" style={{ width: 380, borderRadius: '16px 0 0 16px', height: '100vh', overflowY: 'auto', margin: 0 }}>
                <h3 style={{ marginBottom: 16 }}>{isEdit ? 'Edit User' : 'New User'}</h3>
                {err && <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{err}</div>}
                {F('Username *', 'username')}
                {F('Email *', 'email', 'email')}
                {F('Role *', 'role', 'text',
                    <select value={form.role} onChange={e => setForm((f: any) => ({ ...f, role: e.target.value }))} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                )}
                {ROLE_NEEDS_SITE(form.role) && F('Site *', 'site_id', 'text',
                    <select value={form.site_id} onChange={e => setForm((f: any) => ({ ...f, site_id: e.target.value }))} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                        <option value="">Select site…</option>
                        {sites.map((s: any) => <option key={s.site_id} value={s.site_id}>{s.institution_name}</option>)}
                    </select>
                )}
                {!isEdit && F('Password *', 'password', 'password')}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                        <input type="checkbox" checked={form.mfa_enabled as boolean} onChange={e => setForm((f: any) => ({ ...f, mfa_enabled: e.target.checked }))} /> MFA Enabled
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                        <input type="checkbox" checked={form.is_active as boolean} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} /> Active
                    </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">{save.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create User'}</button>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export const UserManagement: React.FC = () => {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ role: '', is_active: '', site_id: '' });
    const [search, setSearch] = useState('');
    const [slideOver, setSlideOver] = useState<any | null>(null);
    const [resetModal, setResetModal] = useState<{ userId: number; username: string } | null>(null);
    const [newPwd, setNewPwd] = useState('');

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['admin', 'users', filters],
        queryFn: () => adminApi.get('/api/admin/users', { params: filters }).then(r => r.data),
    });

    const { data: sites = [] } = useQuery({
        queryKey: ['admin', 'sites'],
        queryFn: () => adminApi.get('/api/admin/sites').then(r => r.data),
    });

    const toggleActive = useMutation({
        mutationFn: ({ id, active }: { id: number; active: boolean }) =>
            adminApi.put(`/api/admin/users/${id}/${active ? 'activate' : 'deactivate'}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    });

    const resetPwd = useMutation({
        mutationFn: ({ id, pwd }: { id: number; pwd: string }) => adminApi.post(`/api/admin/users/${id}/reset-password`, { new_password: pwd }),
        onSuccess: () => { setResetModal(null); setNewPwd(''); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    });

    const filtered = users.filter((u: any) =>
        !search || u.username.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <h1 className="page-title">User Management</h1>
                <button onClick={() => setSlideOver({})} className="btn-primary"><Plus size={14} /> New User</button>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                        <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                        <input placeholder="Search user…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 26, width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px 6px 24px', fontSize: 13 }} />
                    </div>
                    <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                        <option value="">All roles</option>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                    <select value={filters.is_active} onChange={e => setFilters(f => ({ ...f, is_active: e.target.value }))} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
                        <option value="">Active &amp; Inactive</option>
                        <option value="true">Active only</option>
                        <option value="false">Inactive only</option>
                    </select>
                </div>
            </div>

            <div className="card">
                {isLoading ? <div className="sm-empty">Loading…</div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>{['Username', 'Email', 'Role', 'Site', 'Active', 'MFA', 'Last Login', 'Failed', 'Actions'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>No users found</td></tr>
                                ) : filtered.map((u: any) => (
                                    <tr key={u.user_id}>
                                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>
                                            <button onClick={() => navigate(`/admin/users/${u.user_id}`)} style={{ background: 'none', border: 'none', fontWeight: 700, color: '#3B82F6', cursor: 'pointer', fontSize: 13 }}>{u.username}</button>
                                        </td>
                                        <td style={{ padding: '9px 10px', color: '#6B7280', fontSize: 12 }}>{u.email}</td>
                                        <td style={{ padding: '9px 10px' }}><span className="admin-badge admin-badge-gray" style={{ fontSize: 10 }}>{u.role?.replace(/_/g, ' ')}</span></td>
                                        <td style={{ padding: '9px 10px', fontSize: 12, color: '#6B7280' }}>{u.site_name ?? '—'}</td>
                                        <td style={{ padding: '9px 10px' }}>
                                            <button onClick={() => toggleActive.mutate({ id: u.user_id, active: !u.is_active })}
                                                style={{ background: u.is_active ? '#D1FAE5' : '#FEE2E2', color: u.is_active ? '#065F46' : '#991B1B', border: 'none', borderRadius: 10, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '9px 10px', textAlign: 'center' }}>{u.mfa_enabled ? '✓' : '—'}</td>
                                        <td style={{ padding: '9px 10px', fontSize: 11, color: '#6B7280' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                                        <td style={{ padding: '9px 10px', textAlign: 'center', color: u.failed_login_attempts > 0 ? '#DC2626' : '#9CA3AF' }}>{u.failed_login_attempts}</td>
                                        <td style={{ padding: '9px 10px' }}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => setSlideOver(u)} className="admin-act-btn" style={{ fontSize: 11 }}>Edit</button>
                                                <button onClick={() => setResetModal({ userId: u.user_id, username: u.username })} className="admin-act-btn" style={{ fontSize: 11, color: '#D97706' }}>Reset Pwd</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Slide-over panel */}
            {slideOver !== null && <SlideOver initial={slideOver.user_id ? slideOver : undefined} onClose={() => setSlideOver(null)} sites={sites} />}

            {/* Reset password modal */}
            {resetModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 360 }}>
                        <h3 style={{ marginBottom: 10 }}>Reset Password — {resetModal.username}</h3>
                        <input type="password" placeholder="New password (min 8 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                            style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 13, marginBottom: 12 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => resetPwd.mutate({ id: resetModal.userId, pwd: newPwd })} disabled={newPwd.length < 8 || resetPwd.isPending} className="btn-primary">Reset</button>
                            <button onClick={() => { setResetModal(null); setNewPwd(''); }} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

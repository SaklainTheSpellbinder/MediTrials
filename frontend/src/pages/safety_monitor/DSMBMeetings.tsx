import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar, Plus, ChevronRight, X } from 'lucide-react';
import '../Dashboard.css';

const safetyApi = axios.create({ baseURL: 'http://localhost:5000' });
safetyApi.interceptors.request.use(cfg => {
    const raw = localStorage.getItem('user');
    if (raw) cfg.headers['X-User-Data'] = btoa(raw);
    return cfg;
});

const recColors: Record<string, { bg: string; color: string }> = {
    'Continue': { bg: '#ECFDF5', color: '#059669' },
    'Modify': { bg: '#FFFBEB', color: '#D97706' },
    'Stop': { bg: '#FEF2F2', color: '#DC2626' },
    'Requires Follow-up': { bg: '#EFF6FF', color: '#2563EB' },
};

const ScheduleModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        trial_id: '',
        meeting_date: '',
        meeting_type: 'Scheduled',
        data_cutoff_date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    });
    const { data: trials } = useQuery({ queryKey: ['safety-trials'], queryFn: () => safetyApi.get('/api/safety/trials').then(r => r.data) });

    const mut = useMutation({
        mutationFn: () => safetyApi.post('/api/safety/dsmb', form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['dsmb-list'] }); onClose(); },
    });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Schedule DSMB Meeting</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><X size={18} /></button>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label className="form-label">Trial <span style={{ color: '#DC2626' }}>*</span></label>
                        <select className="form-select" value={form.trial_id} onChange={e => setForm(f => ({ ...f, trial_id: e.target.value }))}>
                            <option value="">Select trial…</option>
                            {(trials ?? []).map((t: any) => <option key={t.trial_id} value={t.trial_id}>{t.trial_title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Meeting Date <span style={{ color: '#DC2626' }}>*</span></label>
                        <input className="form-input" type="date" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Meeting Type</label>
                        <select className="form-select" value={form.meeting_type} onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))}>
                            {['Scheduled', 'Emergency', 'Ad-hoc'].map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Data Cutoff Date</label>
                        <input className="form-input" type="date" value={form.data_cutoff_date} onChange={e => setForm(f => ({ ...f, data_cutoff_date: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)', paddingTop: 16 }}>
                        <button className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn-primary" disabled={!form.trial_id || !form.meeting_date || mut.isPending} onClick={() => mut.mutate()}>
                            {mut.isPending ? 'Scheduling…' : 'Schedule Meeting'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MeetingDetailModal: React.FC<{ meetingId: number; onClose: () => void }> = ({ meetingId, onClose }) => {
    const qc = useQueryClient();
    const [recommendation, setRecommendation] = useState('');
    const [minutesText, setMinutesText] = useState('');
    const [msg, setMsg] = useState('');

    const { data: rawData, isLoading } = useQuery({
        queryKey: ['dsmb-detail', meetingId],
        queryFn: () => safetyApi.get(`/api/safety/dsmb/${meetingId}`).then(r => r.data),
        onSuccess: (d: any) => {
            setRecommendation(d.recommendation ?? '');
            setMinutesText(d.meeting_minutes?.text ?? '');
        },
    } as any);
    const data: any = rawData;

    const updateMut = useMutation({
        mutationFn: () => safetyApi.put(`/api/safety/dsmb/${meetingId}`, {
            recommendation, meeting_minutes: { text: minutesText, updated: new Date().toISOString() }
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['dsmb-list'] }); setMsg('Saved ✓'); setTimeout(() => setMsg(''), 3000); },
        onError: (e: any) => setMsg(e.message),
    });

    if (isLoading) return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '3rem', color: 'var(--gray-400)' }}>Loading…</div>
        </div>
    );
    if (!data) return null;
    const snapshot = data.safetySnapshot;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 12, width: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>DSMB Meeting — {data.meeting_date?.split('T')[0]}</h3>
                        <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: '0.8rem' }}>{data.trial_title} · {data.meeting_type}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}><X size={18} /></button>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Safety snapshot at cutoff */}
                    {snapshot && (
                        <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '1rem' }}>
                            <h4 style={sh}>Safety Data at Cutoff ({data.data_cutoff_date?.split('T')[0]})</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                                {[
                                    { label: 'Total AEs', value: snapshot.total_ae },
                                    { label: 'Serious AEs', value: snapshot.total_sae },
                                    { label: 'Active Alerts', value: snapshot.active_alerts },
                                    { label: 'Deviations', value: snapshot.total_deviations },
                                ].map((k, i) => (
                                    <div key={i} style={{ textAlign: 'center' }}>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{k.value ?? '—'}</p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--gray-500)' }}>{k.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendation */}
                    <div>
                        <label className="form-label">Board Recommendation</label>
                        <select className="form-select" value={recommendation} onChange={e => setRecommendation(e.target.value)}>
                            <option value="">Not yet determined</option>
                            {['Continue', 'Modify', 'Stop', 'Requires Follow-up'].map(r => <option key={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* Minutes */}
                    <div>
                        <label className="form-label">Meeting Minutes</label>
                        <textarea className="ack-textarea" rows={8} value={minutesText} onChange={e => setMinutesText(e.target.value)}
                            placeholder="Enter meeting minutes, discussion points, action items…" />
                    </div>

                    {msg && <p style={{ color: msg.includes('✓') ? '#10B981' : '#DC2626', fontSize: '0.875rem' }}>{msg}</p>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={onClose}>Close</button>
                        <button className="btn-primary" disabled={updateMut.isPending} onClick={() => updateMut.mutate()}>
                            {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const sh: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export const DSMBMeetings: React.FC = () => {
    const [showSchedule, setShowSchedule] = useState(false);
    const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);

    const { data: meetings = [], isLoading } = useQuery({
        queryKey: ['dsmb-list'],
        queryFn: () => safetyApi.get('/api/safety/dsmb').then(r => r.data),
    });

    const typeColor = { 'Scheduled': '#2563EB', 'Emergency': '#DC2626', 'Ad-hoc': '#F59E0B' };

    return (
        <div className="dashboard-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">DSMB Meetings</h1>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Data Safety Monitoring Board meeting management</p>
                </div>
                <button className="btn-primary" onClick={() => setShowSchedule(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={16} /> Schedule Meeting
                </button>
            </div>

            <div className="card">
                {isLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading meetings…</div>
                ) : meetings.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                        <Calendar size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <p>No DSMB meetings scheduled yet.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="sm-table">
                            <thead>
                                <tr><th>Meeting Date</th><th>Trial</th><th>Type</th><th>Data Cutoff</th><th>Recommendation</th><th>Minutes</th><th></th></tr>
                            </thead>
                            <tbody>
                                {meetings.map((m: any) => {
                                    const rc = recColors[m.recommendation] ?? { bg: '#F3F4F6', color: '#6B7280' };
                                    return (
                                        <tr key={m.meeting_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedMeetingId(m.meeting_id)}>
                                            <td style={{ fontWeight: 600 }}>{m.meeting_date?.split('T')[0]}</td>
                                            <td style={{ fontSize: '0.8rem' }}>{m.trial_title}</td>
                                            <td>
                                                <span style={{ background: (typeColor as any)[m.meeting_type] + '20', color: (typeColor as any)[m.meeting_type] ?? '#6B7280', padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600 }}>
                                                    {m.meeting_type}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8rem' }}>{m.data_cutoff_date?.split('T')[0] ?? '—'}</td>
                                            <td>
                                                {m.recommendation ? (
                                                    <span style={{ background: rc.bg, color: rc.color, padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>
                                                        {m.recommendation}
                                                    </span>
                                                ) : <span style={{ color: 'var(--gray-300)' }}>Pending</span>}
                                            </td>
                                            <td>
                                                {m.meeting_minutes ? (
                                                    <span style={{ color: '#2563EB', fontSize: '0.78rem' }}>✓ Available</span>
                                                ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                                            </td>
                                            <td><ChevronRight size={14} color="var(--gray-400)" /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showSchedule && <ScheduleModal onClose={() => setShowSchedule(false)} />}
            {selectedMeetingId && <MeetingDetailModal meetingId={selectedMeetingId} onClose={() => setSelectedMeetingId(null)} />}
        </div>
    );
};

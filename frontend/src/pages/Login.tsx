import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login: authLogin } = useAuth();
    const [role, setRole] = useState('Principal_Investigator'); // Default to match DB schema
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Matches the 'role' column in your DB exactly (with underscores)
    const roleOptions = [
        { value: 'Principal_Investigator', label: 'Principal Investigator' },
        { value: 'Study_Coordinator', label: 'Study Coordinator' },
        { value: 'Safety_Monitor', label: 'Safety Monitor' },
        { value: 'Data_Manager', label: 'Data Manager' },
        { value: 'Statistician', label: 'Statistician' },
        { value: 'System_Admin', label: 'System Admin' }
    ];

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Pass exact DB values
            await authLogin(username, password, role);
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Login error:', err);
            if (err.message.includes('401')) {
                setError('Invalid credentials or role.');
            } else {
                setError(err.message || 'Login failed. Check server.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Quick-fill test credentials (real DB users, all share the same hash) ──
    const PASS = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f';
    const fillTestCredentials = (testUser: string) => {
        const credentials: Record<string, { user: string, pass: string, role: string }> = {
            'investigator': {
                user: 'pi_site_1',
                pass: PASS,
                role: 'Principal_Investigator'
            },
            'coordinator': {
                user: 'coord_site_1',
                pass: PASS,
                role: 'Study_Coordinator'
            },
            'safety_monitor': {
                user: 'safety_1',
                pass: PASS,
                role: 'Safety_Monitor'
            },
            'data_manager': {
                user: 'datamgr_1',
                pass: PASS,
                role: 'Data_Manager'
            },
            'statistician': {
                user: 'stat_1',
                pass: PASS,
                role: 'Statistician'
            },
            'admin': {
                user: 'admin',
                pass: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
                role: 'System_Admin'
            }
        };

        const creds = credentials[testUser];
        if (creds) {
            setUsername(creds.user);
            setPassword(creds.pass);
            setRole(creds.role);
            setError('');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-icon">
                        <ShieldCheck size={32} />
                    </div>
                    <h1>MEDITRIALS</h1>
                    <p>Clinical Research Suite</p>
                </div>

                {error && (
                    <div className="error-message">⚠️ {error}</div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Role</label>
                        <div className="select-wrapper">
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                disabled={loading}
                            >
                                {roleOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
                    </button>

                    {/* Quick Test Buttons */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Quick fill (Dev):</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => fillTestCredentials('investigator')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                PI (pi_site_1)
                            </button>
                            <button type="button" onClick={() => fillTestCredentials('coordinator')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                Coordinator (coord_site_1)
                            </button>
                            <button type="button" onClick={() => fillTestCredentials('safety_monitor')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                Safety (safety_1)
                            </button>
                            <button type="button" onClick={() => fillTestCredentials('data_manager')} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                Data Mgr (datamgr_1)
                            </button>
                            <button type="button" onClick={() => fillTestCredentials('statistician')} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                Statistician (stat_1)
                            </button>
                            <button type="button" onClick={() => fillTestCredentials('admin')} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded font-semibold">
                                Admin (admin)
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );

};
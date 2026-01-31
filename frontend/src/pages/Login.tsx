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

    // ✅ UPDATED: Uses the REAL data we inserted into PostgreSQL
    const fillTestCredentials = (testUser: string) => {
        const credentials: Record<string, { user: string, pass: string, role: string }> = {
            'investigator': {
                user: 'dr_connor', // From Site 1 (Mass General)
                pass: 'hashed_pass_123',
                role: 'Principal_Investigator' // Fixed: underscore to match DB
            },
            'nurse': {
                user: 'nurse_joy', // From Site 1
                pass: 'hashed_pass_123',
                role: 'Study_Coordinator' // Fixed: underscore to match DB
            },
            'monitor': {
                user: 'dr_watson', // Using a PI as monitor for testing
                pass: 'hashed_pass_123',
                role: 'Principal_Investigator' // Fixed: underscore to match DB
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

                    {/* Quick Test Buttons with REAL DB Data */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Auto-fill (Real DB Users):</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => fillTestCredentials('investigator')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                PI (Dr. Connor)
                            </button>
                            <button type="button" onClick={() => fillTestCredentials('nurse')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                Nurse (Joy)
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
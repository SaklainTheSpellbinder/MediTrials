import React from 'react';
import {User } from 'lucide-react';
import './Header.css';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = ()=>{
    const {user} = useAuth();
    return (
        <header className="header">
            <div className="header-actions">
                <div className="role-badge">
                    {user?.role || 'User'}
                </div>

                <div className="user-profile">
                    <div className="avatar">
                        <User size={18} />
                    </div>
                    <span className="user-name">{user?.username|| 'Guest'}</span>
                </div>
                
            </div>
        </header>
    );
};

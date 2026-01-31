import React from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import './MainLayout.css';
import { useAuth } from '../../contexts/AuthContext'; 
import { Navigate } from 'react-router-dom';
interface MainLayoutProps {
    children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content-wrapper">
                <Header />
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

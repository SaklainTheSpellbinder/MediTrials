import React, { useState } from 'react';
import { Search, Filter, Download, Plus, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import './PatientRegistry.css';

// Mock Data
const PATIENTS = [
    { id: 'PT-00123', name: 'John Doe', age: 45, site: '101', status: 'Active', lastVisit: '2024-01-15', gender: 'M' },
    { id: 'PT-00124', name: 'Jane Smith', age: 32, site: '101', status: 'Completed', lastVisit: '2024-01-10', gender: 'F' },
    { id: 'PT-00125', name: 'Bob Johnson', age: 58, site: '203', status: 'Active', lastVisit: '2024-01-14', gender: 'M' },
    { id: 'PT-00126', name: 'Alice Brown', age: 41, site: '101', status: 'Withdrawn', lastVisit: '2023-12-20', gender: 'F' },
    { id: 'PT-00127', name: 'Charlie White', age: 67, site: '203', status: 'Active', lastVisit: '2024-01-16', gender: 'M' },
    { id: 'PT-00128', name: 'Diana Prince', age: 29, site: '102', status: 'Screening', lastVisit: '2024-01-17', gender: 'F' },
];

export const PatientRegistry: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPatients = PATIENTS.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'success';
            case 'Completed': return 'primary';
            case 'Withdrawn': return 'danger';
            case 'Screening': return 'warning';
            default: return 'gray';
        }
    };

    return (
        <div className="registry-container">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Patient Registry</h1>
                    <p className="text-gray-500 text-sm">Trial: COVID-VAX-2024</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary flex items-center gap-2">
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="btn-primary flex items-center gap-2">
                        <Plus size={16} /> New Patient
                    </button>
                </div>
            </div>

            <div className="card">
                {/* Toolbar */}
                <div className="table-toolbar">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button className="btn-secondary flex items-center gap-2">
                        <Filter size={16} /> Filters
                    </button>
                </div>

                {/* Table */}
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Age/Gen</th>
                                <th>Site</th>
                                <th>Status</th>
                                <th>Last Visit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((patient) => (
                                <tr key={patient.id}>
                                    <td className="font-mono">{patient.id}</td>
                                    <td className="font-medium text-gray-900">{patient.name}</td>
                                    <td>{patient.age} / {patient.gender}</td>
                                    <td>{patient.site}</td>
                                    <td>
                                        <span className={`status-badge status-${getStatusColor(patient.status)}`}>
                                            {patient.status}
                                        </span>
                                    </td>
                                    <td>{patient.lastVisit}</td>
                                    <td>
                                        <Link to={`/patients/${patient.id}`} className="btn-icon">
                                            <MoreHorizontal size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="table-footer">
                    <p>Showing {filteredPatients.length} of {PATIENTS.length} patients</p>
                    <div className="pagination">
                        <button disabled>Previous</button>
                        <button className="active">1</button>
                        <button>2</button>
                        <button>Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

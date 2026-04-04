import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, TestTube, X, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import type { Patient } from './PatientList';
import { coordinatorAPI } from '../../../services/api';
import '../Coordinator.css';

interface LabTest {
  test_id: number;
  test_name: string;
  test_code_loinc: string | null;
  unit_of_measure: string;
  critical_low_value: number | null;
  critical_high_value: number | null;
}

interface LabEntryFormProps {
  patient: Patient;
  visitInstanceId: number;
  visitName: string;
  onBack: () => void;
}

export const LabEntryForm: React.FC<LabEntryFormProps> = ({
  patient, visitInstanceId, visitName, onBack
}) => {
  const qc = useQueryClient();
  const [activeTest, setActiveTest] = useState<LabTest | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [savedTests, setSavedTests] = useState<number[]>([]); // test_ids already logged this session

  // Fetch all lab tests from laboratory_tests table via coordinatorAPI (centralized)
  const { data: tests = [], isLoading } = useQuery<LabTest[]>({
    queryKey: ['lab-tests'],
    queryFn: () => coordinatorAPI.getLabTests(),
    staleTime: Infinity, // lab test list rarely changes
  });

  // Submit mutation
  const submitMut = useMutation({
    mutationFn: () => coordinatorAPI.submitLabResult({
      patient_id: patient.db_id!,
      visit_instance_id: visitInstanceId,
      test_id: activeTest!.test_id,
      result_value: parseFloat(inputValue),
    }),
    onSuccess: () => {
      setSavedTests(prev => [...prev, activeTest!.test_id]);
      setActiveTest(null);
      setInputValue('');
    },
  });

  const handleOpen = (test: LabTest) => {
    setActiveTest(test);
    setInputValue('');
    submitMut.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue || isNaN(parseFloat(inputValue))) return;
    submitMut.mutate();
  };

  // Determine range flag for preview
  const getRangeFlag = (test: LabTest, val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    if (test.critical_low_value != null && n <= test.critical_low_value) return 'low';
    if (test.critical_high_value != null && n >= test.critical_high_value) return 'high';
    return 'normal';
  };

  const previewFlag = activeTest && inputValue ? getRangeFlag(activeTest, inputValue) : null;

  return (
    <div className="coord-container" style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={onBack} className="coord-action-icon"
          style={{ width: '2.75rem', height: '2.75rem', background: '#fff', border: '1px solid #e5e7eb', color: '#4b5563', cursor: 'pointer', marginBottom: 0, flexShrink: 0 }}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <div className="coord-badge coord-badge-teal" style={{ marginBottom: '0.5rem' }}>
            <TestTube size={12} /> Lab Entry
          </div>
          <h1 className="coord-page-title" style={{ fontSize: '1.5rem' }}>Laboratory Test Results</h1>
          <p className="coord-page-subtitle">
            Patient: <strong>{patient.patient_id}</strong> &nbsp;·&nbsp; Visit: <strong>{visitName}</strong>
          </p>
        </div>
        <div style={{ marginLeft: 'auto', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.6rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
          <CheckCircle size={14} /> {savedTests.length} logged this visit
        </div>
      </div>

      {/* Test List */}
      <div className="coord-content-card">
        <div className="coord-card-header">
          <h3><TestTube size={18} color="#0d9488" /> Available Tests</h3>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Click "Log" to enter a value</span>
        </div>

        {isLoading ? (
          <div className="coord-empty-state">
            <div className="coord-spinner" style={{ width: '2rem', height: '2rem', color: '#0d9488', borderWidth: '3px' }} />
          </div>
        ) : (
          <div style={{ padding: '0.5rem' }}>
            {tests.map((test) => {
              const done = savedTests.includes(test.test_id);
              return (
                <div key={test.test_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.25rem', borderRadius: '0.75rem', marginBottom: '0.4rem',
                  background: done ? '#f0fdf4' : '#fafafa',
                  border: `1px solid ${done ? '#bbf7d0' : '#e5e7eb'}`,
                  gap: '1rem',
                }}>
                  {/* Left: test info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', flexShrink: 0,
                      background: done ? '#dcfce7' : '#f0fdfa', border: `1px solid ${done ? '#bbf7d0' : '#ccfbf1'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800, color: done ? '#16a34a' : '#0d9488',
                    }}>
                      {done ? <CheckCircle size={16} /> : test.test_name.substring(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{test.test_name}</div>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Unit: <strong>{test.unit_of_measure || '—'}</strong></span>
                        {test.test_code_loinc && (
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>LOINC: {test.test_code_loinc}</span>
                        )}
                        {(test.critical_low_value != null || test.critical_high_value != null) && (
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                            Ref: {test.critical_low_value ?? '?'} – {test.critical_high_value ?? '?'} {test.unit_of_measure}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: action */}
                  {done ? (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle size={14} /> Logged
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpen(test)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb',
                        background: 'white', fontWeight: 700, fontSize: '0.85rem', color: '#374151',
                        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.color = '#0d9488'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
                    >
                      <Plus size={14} /> Log Result
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Value-entry modal */}
      {activeTest && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setActiveTest(null)}>
          <div style={{
            background: 'white', borderRadius: '1rem', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ background: 'linear-gradient(135deg, #0d9488, #059669)', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>Enter Result</p>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{activeTest.test_name}</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                  {patient.patient_id} &nbsp;·&nbsp; {visitName}
                </p>
              </div>
              <button onClick={() => setActiveTest(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '2rem', height: '2rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              {/* Reference info */}
              {(activeTest.critical_low_value != null || activeTest.critical_high_value != null) && (
                <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#0f766e' }}>
                  Reference range: <strong>{activeTest.critical_low_value ?? '?'} – {activeTest.critical_high_value ?? '?'} {activeTest.unit_of_measure}</strong>
                </div>
              )}

              {/* Value input */}
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', color: '#374151', marginBottom: '0.4rem' }}>
                Result Value ({activeTest.unit_of_measure || 'no unit'})
              </label>
              <input
                type="number"
                step="any"
                autoFocus
                placeholder="0.00"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '0.75rem 1rem', fontSize: '1.5rem', fontWeight: 800,
                  border: `2px solid ${previewFlag === 'high' || previewFlag === 'low' ? '#fca5a5' : '#e5e7eb'}`,
                  borderRadius: '0.6rem', outline: 'none', color: '#111827',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#0d9488'}
                onBlur={e => e.target.style.borderColor = previewFlag === 'high' || previewFlag === 'low' ? '#fca5a5' : '#e5e7eb'}
              />

              {/* Live range preview */}
              {previewFlag && (
                <div style={{
                  marginTop: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: previewFlag === 'normal' ? '#f0fdf4' : '#fef2f2',
                  color: previewFlag === 'normal' ? '#16a34a' : '#b91c1c',
                }}>
                  {previewFlag !== 'normal' && <AlertTriangle size={14} />}
                  {previewFlag === 'normal' ? '✓ Within reference range' : `⚠ ${previewFlag === 'high' ? 'Above' : 'Below'} critical threshold — will be flagged`}
                </div>
              )}

              {submitMut.isError && (
                <div style={{ marginTop: '0.75rem', color: '#b91c1c', fontSize: '0.8rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}>
                  {(submitMut.error as any)?.response?.data?.error || 'Failed to save. Try again.'}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setActiveTest(null)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.6rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={!inputValue || submitMut.isPending}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.6rem', border: 'none', background: '#0d9488', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: !inputValue || submitMut.isPending ? 0.6 : 1 }}>
                  {submitMut.isPending ? <><div className="coord-spinner" style={{ width: '0.9rem', height: '0.9rem', borderWidth: '2px', color: 'white' }} /> Saving</> : 'Save Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

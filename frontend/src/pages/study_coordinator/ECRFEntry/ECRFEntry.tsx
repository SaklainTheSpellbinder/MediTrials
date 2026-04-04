import React, { useState } from 'react';
import { PatientList, type Patient } from './PatientList';
import { ClinicalForm } from './ClinicalForm';

export const ECRFEntry: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Background styling for the whole page
  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
      {!selectedPatient ? (
        <PatientList onSelectPatient={setSelectedPatient} />
      ) : (
        <ClinicalForm
          patient={selectedPatient}
          onBack={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
};
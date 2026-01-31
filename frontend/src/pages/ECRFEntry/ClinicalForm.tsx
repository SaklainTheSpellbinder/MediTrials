import React, { useState } from 'react';
import { Activity, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import type { Patient } from './PatientList'; // Import the type

interface ClinicalFormProps {
  patient: Patient;
  onBack: () => void;
}

export const ClinicalForm: React.FC<ClinicalFormProps> = ({ patient, onBack }) => {
  const [formData, setFormData] = useState({
    visitDate: '',
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    temp: '',
  });

  // Reusable Input Component to keep code clean and consistent
  const InputField = ({ label, value, onChange, type = "text", placeholder, suffix }: any) => (
    <div className="mb-1">
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <div className="relative">
        <input 
          type={type} 
          placeholder={placeholder}
          className="w-full h-12 px-4 bg-white border border-slate-300 rounded-lg text-slate-800 text-base shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 placeholder:text-slate-400"
          value={value}
          onChange={onChange}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 bg-white pl-2">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-right-4 duration-500">
      
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="flex items-center text-slate-500 hover:text-indigo-700 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Registry
        </button>
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex gap-6">
           <div><span className="text-xs text-slate-400 uppercase font-bold">Subject</span> <span className="font-bold text-slate-800 ml-1">{patient.id}</span></div>
           <div><span className="text-xs text-slate-400 uppercase font-bold">Site</span> <span className="font-bold text-slate-800 ml-1">{patient.siteId}</span></div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg"><Activity className="w-6 h-6 text-indigo-300" /></div>
            <div>
              <h2 className="font-bold text-xl">Visit 1: Vital Signs</h2>
              <p className="text-slate-400 text-sm">Protocol 2.1 - Standard Vitals</p>
            </div>
          </div>
        </div>

        <form className="p-8 space-y-8">
          {/* Section 1: Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InputField 
              label="Date of Assessment" 
              type="date" 
              value={formData.visitDate}
              onChange={(e: any) => setFormData({...formData, visitDate: e.target.value})}
            />
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: BP */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Blood Pressure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                label="Systolic Pressure" 
                type="number" 
                placeholder="120" 
                suffix="mmHg"
                value={formData.systolicBP}
                onChange={(e: any) => setFormData({...formData, systolicBP: e.target.value})}
              />
              <InputField 
                label="Diastolic Pressure" 
                type="number" 
                placeholder="80" 
                suffix="mmHg"
                value={formData.diastolicBP}
                onChange={(e: any) => setFormData({...formData, diastolicBP: e.target.value})}
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 3: Other Vitals */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Other Measurements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                label="Heart Rate" 
                type="number" 
                suffix="bpm"
                value={formData.heartRate}
                onChange={(e: any) => setFormData({...formData, heartRate: e.target.value})}
              />
              <InputField 
                label="Body Temperature" 
                type="number" 
                suffix="°C"
                value={formData.temp}
                onChange={(e: any) => setFormData({...formData, temp: e.target.value})}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-md text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Please double check values before saving.</span>
            </div>
            <button 
              type="button"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
            >
              <Save className="w-4 h-4" /> SAVE RECORD
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
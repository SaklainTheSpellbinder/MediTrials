import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// ── Route Imports ─────
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import patientProfileRoutes from './routes/patientProfileRoutes';
import screeningRoutes from './routes/screeningRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import coordinatorRoutes from './routes/coordinatorRoutes';
import ecrfRoutes from './routes/ecrfRoutes';
import labRoutes from './routes/labRoutes';
import safetyMonitorRoutes from './routes/safetyMonitorRoutes';
import dataManagerRoutes from './routes/dataManagerRoutes';
import statisticianRoutes from './routes/statisticianRoutes';
import adminRoutes from './routes/adminRoutes';
import piSafetyRoutes from './routes/piSafetyRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Data'],
}));
app.options(/.*/, cors());
app.use(express.json());

// ── Route Mounting ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients', patientProfileRoutes);
app.use('/api/screening', screeningRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/ecrf', ecrfRoutes);
app.use('/api/labs', labRoutes);

// Safety Monitor
app.use('/api/dashboard', safetyMonitorRoutes);
app.use('/api/safety', safetyMonitorRoutes);

// PI Safety
app.use('/api/pi-safety', piSafetyRoutes);

// Data Manager
app.use('/api/dashboard', dataManagerRoutes);
app.use('/api/data-management', dataManagerRoutes);

// Statistician
app.use('/api/dashboard', statisticianRoutes);
app.use('/api/statistics', statisticianRoutes);
app.use('/api/export', statisticianRoutes);

// Admin
app.use('/api/dashboard', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit', adminRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send('MediTrials Backend is Running');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
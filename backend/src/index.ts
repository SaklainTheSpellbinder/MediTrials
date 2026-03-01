import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import coordinatorRoutes from './routes/coordinatorRoutes';
import safetyMonitorRoutes from './routes/safetyMonitorRoutes';
import dataManagerRoutes from './routes/dataManagerRoutes';
import statisticianRoutes from './routes/statisticianRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Data'],
}));
app.options(/.*/, cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard', safetyMonitorRoutes);
app.use('/api/safety', safetyMonitorRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/dashboard', dataManagerRoutes);
app.use('/api/data-management', dataManagerRoutes);
app.use('/api/dashboard', statisticianRoutes);
app.use('/api/statistics', statisticianRoutes);
app.use('/api/export', statisticianRoutes);   // shared SDTM export
app.use('/api/dashboard', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit', adminRoutes);           // /api/audit — admin audit trail

// Root health-check
app.get('/', (_req, res) => {
  res.send('MediTrials Backend (Connected to DB) is Running');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
// When you are ready for Patients, just add: 
app.use('/api/patients', patientRoutes);
app.use('/api/auth', authRoutes);

// Root Check
app.get('/', (req, res) => {
  res.send('MediTrials Backend (Connected to DB) is Running 🚀');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
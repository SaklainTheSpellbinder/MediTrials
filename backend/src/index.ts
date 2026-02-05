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


import dashboardRoutes from './routes/dashboardRoutes';
import coordinatorRoutes from './routes/coordinatorRoutes';

app.use('/api/patients', patientRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/coordinator', coordinatorRoutes);

// Root Check
app.get('/', (req, res) => {
  res.send('MediTrials Backend (Connected to DB) is Running');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
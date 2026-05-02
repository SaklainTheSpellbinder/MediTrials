# MediTrials System Architecture & Documentation

This project handles the frontend and backend of the MediTrials clinical trial management system. The frontend is built with React, and the backend with Express.js + PostgreSQL. 

The architecture leverages database-level intelligence using triggers, views, and stored procedures to handle complex trial logic securely, with the backend node application acting as an API gateway mapping these capabilities to the frontend UI.

---

## 🏗 Backend Core & Connectivity

- [**`backend/src/index.ts`**](file:///d:/MediTrials/backend/src/index.ts): The main entry point for the Express server. It handles CORS, parses JSON, and mounts all base routers.
- [**`backend/src/config/db.ts`**](file:///d:/MediTrials/backend/src/config/db.ts): Uses the native `pg` Node library `Pool` to connect to PostgreSQL. It securely applies credentials from the environment and maps directly to the `meditrials` schema natively. All backend routers import `pool` from this file to execute database queries.

---

## 🌐 API Maps: Frontend to Backend Connections

All frontend components communicate with the backend via Axios functions defined in [**`frontend/src/services/api.ts`**](file:///d:/MediTrials/frontend/src/services/api.ts). Here is how each set connects to the specific backend node router files:

- **Auth & Login**
  - **API:** `API.post('/auth/login')`
  - **Backend Router:** [**`authRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/authRoutes.ts) (`/api/auth`)

- **Patient Registry** (e.g., [`PatientRegistry.tsx`](file:///d:/MediTrials/frontend/src/pages/Principal_Investigator/PatientRegistry.tsx))
  - **API:** `patientAPI.getAll()` → `GET /api/patients?site_id=...`
  - **Backend Router:** [**`patientRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/patientRoutes.ts)

- **Patient Profiles**
  - **API:** `patientProfileAPI.getHeader()`, `.getTimeline()`, etc.
  - **Backend Router:** [**`patientProfileRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/patientProfileRoutes.ts) handles `/api/patients/:id/profile`, `/clinical`, etc.

- **Screening & Enrollment** 
  - **API:** `screeningAPI` methods like `.getCriteria()`, `.submitForPiReview()`.
  - **Backend Router:** [**`screeningRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/screeningRoutes.ts) handles `/api/screening/...`.

- **Laboratory Tracking**
  - **API:** `labAPI` methods.
  - **Backend Router:** [**`labRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/labRoutes.ts) handles `/api/labs/...`.

- **eCRF Forms**
  - **API:** `ecrfAPI.submit()`
  - **Backend Router:** [**`ecrfRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/ecrfRoutes.ts) handles POSTs to `/api/ecrf/submit`.

- **Role-Based Dashboards & Specialized Modules**
  The system uses distinct routers to handle granular permission-based reporting and actions:
  - **PI Dashboard & Safety:** Handled by [**`dashboardRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/dashboardRoutes.ts) and [**`piSafetyRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/piSafetyRoutes.ts).
  - **Coordinator Actions:** Handled by [**`coordinatorRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/coordinatorRoutes.ts).
  - **Safety Monitor:** Handled by [**`safetyMonitorRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/safetyMonitorRoutes.ts).
  - **Data Manager:** Handled by [**`dataManagerRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/dataManagerRoutes.ts).
  - **Statistician Data Management:** Handled by [**`statisticianRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/statisticianRoutes.ts).
  - **Admin controls & Audit Trails:** Handled by [**`adminRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/adminRoutes.ts).

---

## 🗄️ Database Architecture & Intelligent Logic

The core PostgreSQL database (schema: `meditrials`) is heavily normalized using tables generated in [**`create_tables.sql`**](file:///d:/MediTrials/database/full_version/create_tables.sql). Much of the clinical business logic is securely pushed down to the database level rather than sitting entirely in Node middleware.

The backend Node.js routers run `pool.query()` specifically invoking these stored procedures, calling from views, or relying on triggers to passively handle compliance logic.

### 1. Triggers (`/database/triggers/`)
Used to automatically ensure data compliance, integrity and safety without manual code blocks in the backend routes. 
- **`audit_table_changes.sql`**: Automatically records changes to comply with strict 21 CFR Part 11 Audit Trail requirements.
- **`check_critical_lab.sql`**: Monitors lab result entries passively. If an entered value triggers a critical limit, it immediately flags it.
- **`update_site_enrollment.sql`**: Automatically adjusts current and target enrollment numbers concurrently when patient states change to avoid race conditions.

### 2. General & Materialized Views (`/database/views/` & `/database/m_views/`)
Used by dashboard routes to fetch complex, joined, and pre-calculated statistics efficiently.
- **`vw_patient_timeline.sql`**: A view that safely aggregates a patient's historical visit instances natively.
- **`vw_pi_dashboard_stats.sql`**: A materialized view that pre-calculates heavy analytics (like screen failures or total active site targets) so the Principal Investigator's dashboard loads extremely quickly. 

### 3. Stored Procedures (`/database/procedures/`)
Invoked via SQL commands (`CALL sp_name(args)`) directly from Node routes to run atomic, complex multi-table transactions natively in Postgres.
- **`sp_randomize_patient`**: Executed securely when a patient passes screening, mapping them to arms atomically to ensure blind integrity during RNG mappings.
- **`sp_export_cdisc_sdtm`**: Used heavily by `statisticianRoutes.ts` to perform mass data mapping required for regulatory agency (e.g. FDA/CDISC) data exports.
- **`sp_detect_safety_signals`**: Executed to search the backend for statistical irregularities or safety signals among adverse events.

---

## 🔐 Roles and Access Control

MediTrials utilizes a strict Role-Based Access Control (RBAC) system managed via JWTs and native React private route components to ensure data security and regulatory compliance:

- **Principal Investigator (PI)**: Oversees site operations, reviews screening data, and monitors patient safety.
- **Study Coordinator**: Manages day-to-day patient visits, eCRF data entry, and lab tracking.
- **Safety Monitor**: Investigates adverse events (AEs/SAEs), unblinding requests, and handles DSMB meetings.
- **Data Manager**: Handles data reviews, data queries, and database locks.
- **Statistician**: Performs survival analyses, interim analyses, and oversees randomization balances.
- **System Admin**: Manages overarching trial configurations, site details, and system access logs.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)

### Setup Instructions

1. **Database Initialization**: 
   Setup the PostgreSQL database by running the initializing SQL scripts in `/database/full_version/create_tables.sql` and the associated procedures and view scripts to generate the `meditrials` schema.

2. **Backend Server**: 
   Navigate to the `/backend` directory, install dependencies, and start the development server:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   (The server will typically run on `http://localhost:5000`)

3. **Frontend Application**: 
   Navigate to the `/frontend` directory, install dependencies, and start the React application:
   ```bash
   cd frontend
   npm install
   npm start
   ```
   (The frontend will typically run on `http://localhost:5173`)

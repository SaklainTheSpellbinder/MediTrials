# MediTrials Architecture & Documentation

This project handles the frontend and backend of the MediTrials clinical trial management system. The frontend is built with React, and the backend with Express + PostgreSQL. Below is a mapping of how the system connects.

## Backend Core Setup
- [**`backend/src/index.ts`**](file:///d:/MediTrials/backend/src/index.ts): The main entry point for the Express server. It configures basic middleware (CORS, JSON payload parsing) and serves as the central router. It mounts feature-specific routers (e.g., `authRoutes`, `patientRoutes`, `screeningRoutes`) under the `/api/` prefix.
- [**`backend/src/config/db.ts`**](file:///d:/MediTrials/backend/src/config/db.ts): Manages the PostgreSQL database connection using the `pg` library's `Pool`. It securely reads connection parameters (user, host, database, port, and schema mapping) from environment variables via `dotenv` and handles unexpected connection errors.

## API Services (Frontend -> Backend map)
The frontend uses [**`frontend/src/services/api.ts`**](file:///d:/MediTrials/frontend/src/services/api.ts) to define Axios HTTP calls that interact with the corresponding backend routes.

- **PatientRegistry** ([`PatientRegistry.tsx`](file:///d:/MediTrials/frontend/src/pages/Principal_Investigator/PatientRegistry.tsx))  
  Queries all patients of the current user's `site_id` using the `patientAPI.getAll()` function. This sends a `GET` request to `/api/patients?site_id=...`, which maps to [**`patientRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/patientRoutes.ts) on the backend for querying logic.
  
- **Patient Profile** ([e.g. `PatientProfile.tsx`](file:///d:/MediTrials/frontend/src/pages/Principal_Investigator/PatientProfile.tsx))  
  Fetches various details (header, timeline, docs, clinical) using `patientProfileAPI`. Matches `GET /api/patients/:patientId/profile` and others routed by [**`patientProfileRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/patientProfileRoutes.ts).

- **Screening Queue**  
  Uses the `screeningAPI` object (calling methods like `getCriteria`, `submitForPiReview`) which triggers requests to `/api/screening/...`. Handled on the backend by [**`screeningRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/screeningRoutes.ts).

- **Lab Results Tracking**  
  Uses the `labAPI` object to fetch and review results (`/api/labs`). Maps to the backend [**`labRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/labRoutes.ts).

- **Electronic Case Report Forms (eCRF)**  
  Uses the `ecrfAPI` (`post /api/ecrf/submit`) which triggers [**`ecrfRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/ecrfRoutes.ts) to store data in the backend.

- **Role-based Dashboards**  
  Specialized dashboards (Safety Monitor, Data Manager, Admin, Statistician) make requests targeting base sub-URLs such as `/api/dashboard`, `/api/safety`, `/api/export`, and others. These are routed appropriately in `index.ts` to [**`safetyMonitorRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/safetyMonitorRoutes.ts), [**`dataManagerRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/dataManagerRoutes.ts), [**`adminRoutes.ts`**](file:///d:/MediTrials/backend/src/routes/adminRoutes.ts) etc.

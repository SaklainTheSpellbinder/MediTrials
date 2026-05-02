# MediTrials — Setup & Run Guide

> For architecture and system documentation, see [`README.md`](./README.md).

---

## Prerequisites

Make sure the following are installed before you begin:

- [Node.js](https://nodejs.org/) v18 or higher
- [PostgreSQL](https://www.postgresql.org/) v14 or higher
- A PostgreSQL client (e.g. [pgAdmin](https://www.pgadmin.org/) or `psql` CLI)
- Git

---

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd MediTrials
```

---

## 2. Database Setup

### 2.1 Create the Database

Open pgAdmin or `psql` and create a new database:

```sql
CREATE DATABASE meditrials_db;
```

### 2.2 Run the Schema Scripts

Run the following SQL files **in this exact order** using pgAdmin's query tool or `psql`:

```
1. database/full_version/create_tables.sql
2. database/full_version/ALTER TABLE public.sql
3. database/full_version/new_update_alters.sql
4. database/full_version/trigger_and_stuff.sql
5. database/full_version/007_dm_function.sql
```

You can run them one at a time in pgAdmin by opening each file and clicking **Execute (F5)**.

### 2.3 Create Users

After the schema is ready, insert the application users:

```
database/insert_users.sql
```

---

## ⚠️ A Note on Populating Sample Data

**Populating the database with sample/test data is non-trivial and must be done carefully.**

The schema has a large number of **interdependent foreign key constraints**, **CHECK constraints**, and **database triggers** that fire automatically on every insert (e.g. audit trail triggers, enrollment counters, critical lab value monitors). Because of this complexity:

- Bulk inserts or seed scripts tend to **fail mid-way** due to constraint violations or trigger side effects
- The correct order of insertion matters enormously — e.g. a `patient` row cannot exist without a `study_site`, which cannot exist without a `clinical_trial`, and so on
- **We populated all sample data manually, one insert at a time**, using pgAdmin's query tool — inserting each record individually, verifying it committed, then moving on to the next

If you want to add test data, follow this general order:

```
1. clinical_trials
2. study_sites
3. treatment_arms
4. eligibility_criteria
5. visit_schedules
6. ecrf_definitions / laboratory_tests
7. users  (already done via insert_users.sql)
8. patients
9. patient_enrollments
10. screening_records
11. study_visits / visit_data
12. laboratory_results
13. adverse_events / safety_alerts
```

Insert one row at a time and confirm success before continuing. Do **not** wrap large batches in a single transaction — if one row fails, the whole batch rolls back.

---

## 3. Backend Setup

```bash
cd backend
npm install
```

### 3.1 Configure Environment Variables

Create a `.env` file inside the `backend/` folder (or edit the existing one):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meditrials_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_SCHEMA=public
JWT_SECRET=replace_with_a_long_random_secret_string
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=replace_with_a_different_64_character_random_string
REFRESH_TOKEN_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
BCRYPT_ROUNDS=12
```

> **Important:** Change `DB_PASSWORD` and both secret strings to your own values. Never commit real secrets.

### 3.2 Start the Backend

```bash
npm run dev
```

The backend will start at: **`http://localhost:5000`**

---

## 4. Frontend Setup

Open a **new terminal** in the project root:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at: **`http://localhost:5173`**

---

## 5. Login

Once both servers are running, open your browser and go to:

```
http://localhost:5173
```

Log in using one of the user accounts you inserted via `insert_users.sql`.

The system supports the following roles, each with its own dashboard and page set:

| Role | Dashboard |
|---|---|
| `System_Admin` | Admin Dashboard |
| `Principal_Investigator` | PI Dashboard |
| `Study_Coordinator` | Coordinator Dashboard |
| `Safety_Monitor` | Safety Monitor Dashboard |
| `Data_Manager` | Data Manager Dashboard |
| `Statistician` | Statistician Dashboard |

---

## 6. Running Both Servers Together (Optional)

You can run both backend and frontend simultaneously. From the project root:

**Terminal 1:**
```bash
cd backend && npm run dev
```

**Terminal 2:**
```bash
cd frontend && npm run dev
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` on backend start | PostgreSQL is not running. Start the PostgreSQL service. |
| `relation does not exist` errors | SQL scripts were not all run, or run out of order. Re-run from step 2.2. |
| Login returns 401 immediately | Check that `insert_users.sql` was executed and passwords are bcrypt-hashed. |
| Frontend shows blank/no data | Backend is not running, or `CLIENT_ORIGIN` in `.env` doesn't match the Vite port. |
| Constraint violation on data insert | Follow the manual insertion order in section 2.3 above. |

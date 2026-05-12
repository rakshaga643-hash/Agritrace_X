# AgriTrace X — Backend Setup Guide

## Prerequisites

Install Node.js and MongoDB:

```bash
# Install Node.js (macOS)
brew install node

# Install MongoDB (macOS)
brew tap mongodb/brew
brew install mongodb-community@7.0

# Start MongoDB
brew services start mongodb-community@7.0
```

Or download directly:
- Node.js: https://nodejs.org (v18+ LTS)
- MongoDB: https://www.mongodb.com/try/download/community

---

## Quick Start

```bash
# 1. Navigate to project directory
cd /Users/sreesivarakshaga/agritrace-x

# 2. Install dependencies
npm install

# 3. Seed the database with demo data
npm run seed

# 4. Start the backend server
npm start
```

Open browser: **http://localhost:5000**

---

## Development Mode (auto-restart on changes)

```bash
npm run dev
```

---

## Login Credentials

| Role | User ID | PIN |
|------|---------|-----|
| Farmer | FARMER_091A | 1234 |
| Drone Agent | DRONE_A01 | 2345 |
| Data Analyst | ANALYST_01 | 3456 |
| Insurance Agent | INS_AG01 | 4567 |
| Super Admin | ADMIN_001 | 0000 |

---

## API Endpoints

| Method | Endpoint | Role |
|--------|----------|------|
| POST | `/api/auth/login` | All |
| GET | `/api/auth/me` | All |
| GET | `/api/farmer/dashboard` | Farmer |
| POST | `/api/farmer/farm` | Farmer |
| PUT | `/api/farmer/farm/:id` | Farmer |
| POST | `/api/farmer/crop` | Farmer |
| PUT | `/api/farmer/crop/:id` | Farmer |
| POST | `/api/farmer/crop/:id/fertilizer` | Farmer |
| POST | `/api/farmer/crop/:id/irrigation` | Farmer |
| POST | `/api/farmer/claim` | Farmer |
| GET | `/api/drone/missions` | Drone |
| POST | `/api/drone/mission` | Drone/Admin |
| PUT | `/api/drone/mission/:id/status` | Drone |
| POST | `/api/drone/mission/:id/image` | Drone |
| GET | `/api/analyst/surveys` | Analyst/Admin |
| GET | `/api/analyst/district-summary` | Analyst/Admin |
| GET | `/api/insurance/claims` | Insurance/Admin |
| PUT | `/api/insurance/claim/:id` | Insurance/Admin |
| GET | `/api/admin/users` | Admin |
| POST | `/api/admin/user` | Admin |
| PUT | `/api/admin/user/:id` | Admin |
| GET | `/api/admin/overview` | Admin |

---

## Environment Variables (.env)

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agritracex
JWT_SECRET=agritracex_super_secret_key_2026_govt_platform
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

---

## Database Collections

- `users` — All 5 role users with bcrypt-hashed passwords
- `farms` — Farmland records with GeoPolygons
- `croprecords` — Crop details, fertilizer history, irrigation logs, sensor data
- `missions` — Drone survey missions with waypoints and geo-tagged images
- `insuranceclaims` — PMFBY claims with fraud scores

---

## Architecture

```
agritrace-x/
├── index.html              ← Role-based login (frontend)
├── dashboard-farmer.html   ← Farmer dashboard
├── dashboard-drone.html    ← Drone agent dashboard
├── dashboard-analyst.html  ← Data analyst dashboard
├── dashboard-insurance.html ← Insurance agent dashboard
├── dashboard-admin.html    ← Super admin dashboard
├── dashboard-ai.html       ← AI intelligence center
├── api-client.js           ← Frontend API client (JWT)
├── ai-engine.js            ← Client-side AI module
├── script.js               ← Main GIS dashboard engine
├── style.css               ← Main styles
├── shared-dash.css         ← Role dashboard styles
├── .env                    ← Backend config
├── package.json            ← Node.js dependencies
└── server/
    ├── index.js            ← Express app entry point
    ├── config/
    │   └── db.js           ← MongoDB connection
    ├── models/
    │   ├── User.js         ← User model (all roles)
    │   ├── Farm.js         ← Farmland model
    │   ├── CropRecord.js   ← Crop + soil + fertilizer model
    │   ├── Mission.js      ← Drone mission model
    │   └── InsuranceClaim.js ← Insurance claim model
    ├── routes/
    │   ├── auth.js         ← Login / JWT routes
    │   └── api.js          ← All role-based API routes
    ├── middleware/
    │   └── auth.js         ← JWT verify + role guard
    └── seed.js             ← Demo data seeder
```

> **Note:** The frontend falls back to offline demo mode automatically if the backend server is not running.

# VK IT Solutions — Employee Work Session Tracker

A production-ready full-stack web application for tracking employee work sessions at VK IT Solutions.

## Features

- **Employee Login** — Username + password authentication
- **Start Work Session** — Enter starting form number to begin tracking
- **Finish Work Session** — Enter ending form number, system calculates forms completed
- **Multiple Sessions/Day** — Unlimited sessions per employee per day
- **Auto Next Form** — Automatically suggests next starting form number
- **Session Persistence** — Sessions survive browser close/reopen
- **Employee History** — View sessions by date
- **Admin Dashboard** — Live employee status with Supabase Realtime
- **Excel Export** — Download `.xlsx` reports with daily summary
- **Row Level Security** — Employees can only see their own data
- **Mobile-First** — Designed for Android Chrome (PWA installable)
- **IST Timezone** — All times displayed in Asia/Kolkata

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend/Auth | Supabase (Auth + PostgreSQL + RLS + Realtime) |
| Excel | SheetJS (xlsx) |
| Styling | Vanilla CSS (mobile-first dark theme) |
| Hosting | Vercel |

---

## Project Structure

```
vk-it-tracker/
├── src/
│   ├── components/          # Reusable UI components
│   ├── context/             # React context (AuthContext)
│   ├── layouts/             # EmployeeLayout, AdminLayout
│   ├── pages/
│   │   ├── employee/        # Dashboard, History, Profile
│   │   └── admin/           # Dashboard, Sessions, Reports
│   ├── services/            # Supabase client + API calls
│   ├── styles/              # Global CSS
│   └── utils/               # Date/time helpers, Excel export
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # Tables + triggers
│       ├── 002_rls_policies.sql     # Row Level Security
│       └── 003_functions.sql        # Business logic RPCs
├── scripts/
│   └── seed-users.js        # Creates 11 employees + admin
├── .env.example
├── .env.seed.example
└── README.md
```

---

## Setup Guide

### Step 1: Install Node Dependencies

```bash
npm install
```

### Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for it to initialize (~2 minutes)
4. Go to **Settings → API** and copy:
   - **Project URL** (e.g. `https://xyz.supabase.co`)
   - **anon public key**
   - **service_role key** (keep this SECRET — server-side only)

### Step 3: Configure Environment Variables

**For the frontend (Vite):**
```bash
cp .env.example .env
```
Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**For the seed script:**
Create a `.env` in the project root (same file as above, add these lines):
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ADMIN_EMAIL=admin@vkit.local
ADMIN_PASSWORD=YourSecureAdminPassword123!
```

### Step 4: Run Database Migrations

In the Supabase dashboard, go to **SQL Editor** and run each migration file in order:

1. Copy and run: `supabase/migrations/001_initial_schema.sql`
2. Copy and run: `supabase/migrations/002_rls_policies.sql`
3. Copy and run: `supabase/migrations/003_functions.sql`

Alternatively, if you have Supabase CLI installed:
```bash
supabase db push
```

### Step 5: Enable Realtime

In Supabase Dashboard:
1. Go to **Database → Replication**
2. Enable `work_sessions` table for Realtime

### Step 6: Create Employee Accounts

Run the seed script:
```bash
node scripts/seed-users.js
```

This creates:
- 11 employee accounts
- 1 admin account (using `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`)

**IMPORTANT:** The script will print initial passwords. Share them securely with employees and ask them to change their passwords.

### Step 7: Start Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000`

---

## Employee Accounts

| Name | Username | Login Email (internal) |
|---|---|---|
| Manoj | manoj | manoj@vkit.local |
| Bangaruraju | bangaruraju | bangaruraju@vkit.local |
| Abhi | abhi | abhi@vkit.local |
| Alekya | alekya | alekya@vkit.local |
| Karthik | karthik | karthik@vkit.local |
| Kesava | kesava | kesava@vkit.local |
| Lakshmi | lakshmi | lakshmi@vkit.local |
| Hyndavi | hyndavi | hyndavi@vkit.local |
| Raju | raju | raju@vkit.local |
| Sunil | sunil | sunil@vkit.local |
| Vamsi Krishna | vamsikrishna | vamsikrishna@vkit.local |
| **Admin** | *(set in .env)* | *(set in ADMIN_EMAIL)* |

> **Note:** Employees only type their username (e.g. `manoj`) on the login page. The `@vkit.local` email is used internally by Supabase Auth.

---

## Admin Access

- Navigate to `/login`
- Enter admin username (the part before `@` in `ADMIN_EMAIL`)
- Enter `ADMIN_PASSWORD`
- Automatically redirected to `/admin`

---

## Routes

| Route | Access |
|---|---|
| `/login` | Public |
| `/employee` | Employee only |
| `/employee/history` | Employee only |
| `/employee/profile` | Employee only |
| `/admin` | Admin only |
| `/admin/sessions` | Admin only |
| `/admin/reports` | Admin only |

---

## Database Schema

### `profiles`
| Column | Type | Description |
|---|---|---|
| id | UUID | Matches `auth.users.id` |
| full_name | TEXT | Display name |
| username | TEXT | Unique login username |
| role | TEXT | `employee` or `admin` |
| is_active | BOOLEAN | Account enabled |
| created_at | TIMESTAMPTZ | Creation time |

### `work_sessions`
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| employee_id | UUID | References `profiles.id` |
| work_date | DATE | Business date (IST) |
| session_number | INTEGER | Auto-generated per day |
| starting_form_number | BIGINT | First form of session |
| ending_form_number | BIGINT | Last form (null while working) |
| total_forms | INTEGER | `ending - starting + 1` |
| start_time | TIMESTAMPTZ | When session started |
| end_time | TIMESTAMPTZ | When session completed |
| status | TEXT | `working` or `completed` |

---

## Security

- **Supabase Auth** — Passwords never stored in plain text
- **RLS Policies** — Employees can only read/write their own sessions
- **Server-side RPCs** — Business logic in PostgreSQL, not client-side
- **No service-role key in frontend** — Only `anon` key exposed to browser
- **Completed sessions immutable** — Cannot be edited by employees
- **No session delete** — Historical records preserved

---

## Deployment to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Set environment variables in Vercel dashboard.

### Option B: GitHub + Vercel

1. Push project to GitHub
2. Connect repository to Vercel at [vercel.com](https://vercel.com)
3. Add environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

### Vercel Config (vercel.json)
Create `vercel.json` in root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## PWA / Android Install

On Android Chrome:
1. Visit the app URL
2. Tap the browser menu (⋮)
3. Select "Add to Home Screen"
4. The app launches like a native app

---

## Excel Export

Admin can download reports from `/admin/reports`:
- File name: `VK_IT_Attendance_YYYY-MM-DD.xlsx`
- Sheet 1: Detailed session records
- Sheet 2: Daily summary by employee with grand total

---

## Business Rules

1. **Login ≠ Working** — Employee must press START WORK to begin a session
2. **One active session at a time** — Enforced by DB unique index
3. **Session number auto-generated** — Resets per employee per day
4. **Next form validation** — Must start where last session ended + 1
5. **Completed sessions are immutable** — Cannot be edited
6. **Sessions survive logout** — Browser close does not end a session
7. **IST timezone** — All business dates/times in Asia/Kolkata

---

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run seed script (requires .env with service role key)
node scripts/seed-users.js
```

---

## Support

Contact VK IT Solutions administrator for account issues.

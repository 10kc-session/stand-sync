# Standup Sync - Admin Side Documentation

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Admin Authentication](#admin-authentication)
4. [Admin Features](#admin-features)
5. [Database Schema](#database-schema)
6. [Component Architecture](#component-architecture)
7. [API Integration](#api-integration)
8. [File Structure](#file-structure)
9. [Setup and Configuration](#setup-and-configuration)
10. [Code Explanation](#code-explanation)

## Overview

The Standup Sync application is a React-based attendance management system designed for managing daily standup meetings. The admin side provides comprehensive tools for administrators to schedule standups, manage employees, track attendance, and sync data with Google Sheets.

### Key Technologies Used

- **Frontend**: React 18 with TypeScript
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: React Context API
- **Database**: Supabase (PostgreSQL)
- **Routing**: React Router DOM v6
- **Build Tool**: Vite
- **Form Handling**: React Hook Form
- **Icons**: Lucide React
- **Notifications**: Toast notifications (sonner)

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Client  │────│   Supabase DB    │────│  Google Sheets  │
│   (React App)   │    │   (PostgreSQL)   │    │   Integration   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

1. Admin authenticates using hardcoded credentials
2. Admin performs CRUD operations on employees and standups
3. Data is stored in Supabase database
4. Attendance data is synced to Google Sheets via Apps Script

## Admin Authentication

### Authentication System (`src/context/AdminAuthContext.tsx`)

The admin authentication uses a simple credential-based system with localStorage persistence.

**Hardcoded Admin Credentials:**

```typescript
const ADMIN_CREDENTIALS: Credentials[] = [
  { email: "akhil", password: "admin123" },
  { email: "abhinav", password: "admin" },
  { email: "sowmya", password: "admin123" },
];
```

**Features:**

- Login with email/password
- Session persistence via localStorage
- Context-based state management
- Automatic redirect protection

**Key Functions:**

- `login(email, password)`: Validates credentials and sets admin session
- `logout()`: Clears session and redirects to login
- `useAdminAuth()`: Hook to access admin context

### Login Process

1. Admin enters credentials on `/admin/login`
2. Credentials are validated against hardcoded list
3. On success, admin object is stored in localStorage
4. User is redirected to admin dashboard

## Admin Features

### 1. Admin Dashboard (`src/pages/AdminHome.tsx`)

**Primary Functions:**

- Display today's standup information
- Show attendance summary (present/total)
- Quick access to schedule standup
- Logout functionality

**Key Components:**

- Welcome banner with admin email
- Today's standup time display
- Attendance count visualization
- Navigation to other admin sections

### 2. Employee Management (`src/pages/AdminEmployees.tsx`)

**CRUD Operations:**

- **Create**: Add new employees with name and email
- **Read**: View all employees in a table format
- **Update**: Inline edit employee details
- **Delete**: Remove employees with confirmation dialog

**Features:**

- Real-time table updates
- Inline editing mode
- Add employee dialog
- Delete confirmation alerts
- Form validation
- Loading states

### 3. Standup Scheduling (`src/components/AdminScheduleStandup.tsx`)

**Capabilities:**

- Schedule standups for today with time selection
- View all scheduled standups
- Set current time with "Now" button
- Validation for time selection (6:00 AM - 11:00 PM)

**Integration:**

- Creates standup records in database
- Triggers parent component refresh
- Toast notifications for success/error

### 4. Attendance Management (`src/components/AdminStandupDashboard.tsx`)

**Features:**

- Start/stop standup sessions
- Real-time attendance marking
- Employee checkbox controls
- Google Sheets synchronization
- Local storage backup

**Workflow:**

1. Admin starts standup (creates attendance records)
2. Admin marks attendance for each employee
3. Data syncs to Google Sheets automatically
4. Admin can stop standup and finalize attendance

## Database Schema

### Tables Structure (Supabase)

#### 1. `employees`

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL
);
```

#### 2. `standups`

```sql
CREATE TABLE standups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);
```

#### 3. `attendance`

```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standup_id UUID REFERENCES standups(id),
  employee_id UUID REFERENCES employees(id),
  status TEXT, -- 'Present', 'Absent', 'Missed', 'Not Available'
  marked_at TIMESTAMP DEFAULT NOW(),
  marked_by UUID REFERENCES profiles(id)
);
```

#### 4. `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Component Architecture

### Admin Components Hierarchy

```
App.tsx
├── AdminAuthProvider
├── Routes
    ├── /admin/login → AdminLogin
    ├── /admin → AdminHome
    │   ├── AppNavbar
    │   └── Dashboard Content
    ├── /admin/employees → AdminEmployees
    │   ├── AppNavbar
    │   ├── Employee Table
    │   ├── Add Employee Dialog
    │   └── Edit/Delete Actions
    └── /standups → Standups
        ├── AppNavbar
        ├── AdminScheduleStandup
        └── AdminStandupDashboard
```

### Key Components Detailed

#### 1. `AdminAuthCard.tsx`

- Reusable login form component
- Props-based configuration
- Form validation and error display
- Used in multiple login contexts

#### 2. `AdminScheduleStandup.tsx`

- Standalone scheduling component
- Time picker with validation
- Standup list display
- Callback-based parent updates

#### 3. `AdminStandupDashboard.tsx`

- Real-time attendance tracking
- Google Sheets integration
- State management for live sessions
- Employee status controls

#### 4. `AppNavbar.tsx`

- Consistent navigation across pages
- Admin/user context awareness
- Responsive design

## API Integration

### Supabase Integration

**Configuration (`src/integrations/supabase/client.ts`):**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Common Operations:**

- `supabase.from('table').select()` - Read data
- `supabase.from('table').insert()` - Create records
- `supabase.from('table').update()` - Update records
- `supabase.from('table').delete()` - Delete records

### Google Sheets Integration

**Apps Script URL:**

```typescript
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby8F_q7tY_HuIHwsMpSRYXcbEsXx3mwW69EZAE_fepk2S5w01xeubMRKG084kNBICNb7Q/exec";
```

**Sync Function:**

```typescript
async function syncAttendanceToSheet({ standup, employees, attendance }) {
  const dataToSend = employees.map((emp) => ({
    standup_id: standup.id,
    standup_time: new Date(standup.scheduled_at).toLocaleString(),
    employee_id: emp.id,
    employee_name: emp.name,
    employee_email: emp.email,
    status: attendance[emp.id]?.status || "Absent",
  }));

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records: dataToSend }),
  });
}
```

## File Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── AdminAuthCard.tsx      # Admin login form
│   ├── AdminScheduleStandup.tsx # Standup scheduling
│   ├── AdminStandupDashboard.tsx # Attendance management
│   └── AppNavbar.tsx          # Navigation component
├── context/
│   └── AdminAuthContext.tsx   # Admin authentication state
├── pages/
│   ├── AdminHome.tsx          # Admin dashboard
│   ├── AdminLogin.tsx         # Admin login page
│   ├── AdminEmployees.tsx     # Employee management
│   ├── Attendance.tsx         # Attendance tracking
│   └── Standups.tsx           # Standup management
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client config
│       └── types.ts           # Database type definitions
├── hooks/
│   ├── useUser.ts             # User state management
│   └── use-toast.ts           # Toast notifications
└── lib/
    └── utils.ts               # Utility functions
```

## Setup and Configuration

### Environment Variables Required

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation Steps

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Configure Supabase database
5. Set up Google Apps Script for sheets integration
6. Run development server: `npm run dev`

### Database Setup

1. Create Supabase project
2. Run migration scripts in `supabase/migrations/`
3. Set up Row Level Security (RLS) policies
4. Configure authentication if needed

## Code Explanation

### State Management Patterns

#### 1. Admin Authentication Context

```typescript
// Context provides admin state across components
const AdminAuthContext = createContext<AdminAuthContextType>();

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(() => {
    // Restore from localStorage on init
    const stored = localStorage.getItem("admin");
    return stored ? JSON.parse(stored) : null;
  });

  const login = (email: string, password: string) => {
    // Validate against hardcoded credentials
    const found = ADMIN_CREDENTIALS.find((c) => c.email === email && c.password === password);
    if (found) {
      setAdmin({ email });
      localStorage.setItem("admin", JSON.stringify({ email }));
      return true;
    }
    return false;
  };
};
```

#### 2. Component State Management

```typescript
// Employee management with CRUD operations
const [employees, setEmployees] = useState<Employee[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// Load employees with error handling
const loadEmployees = useCallback(() => {
  setLoading(true);
  setError(null);
  fetchEmployees()
    .then(setEmployees)
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

### Data Fetching Patterns

#### 1. Supabase Queries

```typescript
// Fetch today's standup
const fetchTodayStandup = async () => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("standups")
    .select("*")
    .gte("scheduled_at", todayStr + "T00:00:00.000Z")
    .lt("scheduled_at", todayStr + "T23:59:59.999Z")
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) setTodayStandup(data);
};
```

#### 2. Error Handling

```typescript
// Consistent error handling with toast notifications
try {
  await addEmployee(formData);
  toast({
    title: "Success",
    description: "Employee added successfully",
  });
  loadEmployees(); // Refresh data
} catch (error) {
  toast({
    title: "Error",
    description: error.message,
    variant: "destructive",
  });
}
```

### UI Patterns

#### 1. Form Handling

```typescript
// Form submission with validation
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.name.trim() || !formData.email.trim()) {
    toast({
      title: "Error",
      description: "Please fill in all fields",
      variant: "destructive",
    });
    return;
  }

  setLoading(true);
  // ... submit logic
  setLoading(false);
};
```

#### 2. Conditional Rendering

```typescript
// Show different states based on data availability
{
  loading ? (
    <div>Loading...</div>
  ) : error ? (
    <div className="text-red-500">{error}</div>
  ) : employees.length === 0 ? (
    <div>No employees found.</div>
  ) : (
    <EmployeeTable employees={employees} />
  );
}
```

### Security Considerations

1. **Authentication**: Simple credential-based system (suitable for internal use)
2. **Authorization**: Admin context protects routes
3. **Data Validation**: Client-side validation for forms
4. **Error Handling**: Graceful error handling with user feedback
5. **State Persistence**: localStorage for session management

### Performance Optimizations

1. **React.useCallback**: Memoized functions to prevent unnecessary re-renders
2. **Conditional Rendering**: Efficient DOM updates
3. **Loading States**: Better user experience during async operations
4. **Error Boundaries**: Graceful error handling

### Best Practices Implemented

1. **TypeScript**: Full type safety
2. **Component Composition**: Reusable components
3. **Separation of Concerns**: Logic separated from UI
4. **Consistent Naming**: Clear variable and function names
5. **Error Handling**: Comprehensive error management
6. **User Feedback**: Toast notifications for all actions
7. **Responsive Design**: Mobile-friendly UI
8. **Accessibility**: Proper ARIA labels and semantic HTML

This documentation provides a complete overview of the admin side functionality, architecture, and implementation details of the Standup Sync application.

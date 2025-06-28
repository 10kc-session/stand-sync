# Standup-Sync: AI-Powered Feedback and Attendance Platform

Standup-Sync is a modern, full-stack web application designed to streamline team standup meetings and provide deep, AI-driven insights into employee feedback. The platform features distinct roles for Team Members and Admins, a secure authentication system, real-time attendance tracking, and an advanced AI dashboard for analyzing employee sentiment and performance.

This project was successfully migrated from a Supabase backend to a robust, scalable, and secure architecture built entirely on Google's Firebase platform.

## Core Features

### For All Users
- **Secure Authentication**: Users can sign up and log in via Email/Password or a Google account. The system includes email verification and a "Forgot Password" flow.
- **Seamless Onboarding**: After signing up, new users are automatically directed to a setup page where they must provide their Employee ID and link their personal Feedback Google Sheet before accessing the application.
- **Profile Management**: Logged-in users can update their display name and profile picture through a dedicated profile editor.

### For Team Members
- **Personalized Dashboard (Home)**: A central landing page that displays a user's consecutive attendance streak, an alert if no standup is scheduled, and a personal version of the feedback dashboard.
- **Standup Participation**: View daily standup status and see the final attendance records after a standup has been completed.

### For Admins
- **Central Admin Dashboard (/admin)**: A hub showing a summary of the day's standup and a real-time attendance count.
- **Secure Role-Based Access**: The admin system is protected by Firebase Custom Claims. Only authorized users can access admin functionality.
- **Employee Management (/admin/employees)**:
  - ***View All Users***: Admins can see a full list of all registered employees who have completed their profile setup.
  - ***Search***: A real-time search bar allows admins to instantly filter employees by name, email, or Employee ID.
  - ***Edit Employee Details***: Admins can enter an "Edit Mode" to perform inline updates to any employee's name, email, Employee ID, or assigned Feedback Sheet URL.
  - ***Delete Employee***: Securely delete employee records from Firestore with a confirmation dialog.
  - ***Promote to Admin***: An existing admin can securely promote any other registered user to an admin role via a protected Cloud Function.
- **Standup & Attendance Control (/standups & /attendance)**:
  - Admins can schedule the time for the day's standup.
  - They can initiate the real-time attendance tracking session.
  - They can manually edit attendance records for any employee during a live standup.
- **AI-Powered Feedback Dashboard (/admin/employees/:id)**: The flagship feature. For any employee, an admin can view a detailed dashboard that:
  - Fetches feedback data from that employee's private, restricted-access Google Sheet.
  - Uses the Gemini 1.5 Flash AI model to analyze and summarize text comments into structured insights.
  - Displays Positive Feedback (as quotes with keywords) and actionable Areas for Improvement (as themes with suggestions) in a clean, card-based UI.
  - Visualizes quantitative data in two ways:
    - A Bar Chart for single-period summaries (Today, Specific Day, This Month).
    - A Line Chart to show feedback trends over a selected date range or the full history.
  - Allows advanced filtering of feedback data by "Today," a specific month/year, a custom date range, or the entire sheet history.
- **Google Sheets Integration**: All attendance data can be synced to a separate master Google Sheet with the click of a button for record-keeping.

## Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Routing**: React Router v6
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **State Management**: React Context API
- **Charting**: Chart.js & react-chartjs-2
- **Date Handling**: date-fns

### Backend & Infrastructure
- **Platform**: Google Firebase
- **Authentication**: Firebase Authentication (Email/Password, Google Sign-In, Custom Claims)
- **Database**: Firestore (NoSQL)
- **File Storage**: Firebase Storage
- **Serverless Logic**: Firebase Cloud Functions (v2) in TypeScript
- **AI Model**: Google's Gemini 1.5 Flash API
- **External Integration**: Google Sheets API via a dedicated Service Account

## Architecture and Data Flow

### 1. User Onboarding & Authentication Flow

1. **AuthPage (`/auth`)**  
   - Manages email/password and Google sign-in in `AuthPage.tsx`.  
   - **On signup**:  
     - Calls `createUserWithEmailAndPassword`  
     - Runs `updateProfile` to set display name  
     - Creates Firestore doc at `employees/{uid}` with  
       `{ uid, email, name, hasCompletedSetup: false }`  
     - Sends email verification  
   - **On login**:  
     - Uses `signInWithEmailAndPassword` or `signInWithPopup`  
     - Invokes `handleSuccessfulLogin`

2. **`handleSuccessfulLogin`** (in `AuthPage.tsx`)  
   - Refreshes token via `getIdTokenResult()` and checks `isAdmin` claim  
     - If **admin**, redirects to `/admin`  
   - Otherwise, fetches `employees/{uid}` doc:  
     - If `hasCompletedSetup === true`, redirects to `/`  
     - Else (no doc or incomplete), creates it if needed and redirects to `/setup`

3. **Profile Setup (`/setup`)**  
   - Wrapped in `ProtectedRoute`  
   - `EmployeeSetup.tsx` validates:  
     - **Employee ID** must match `/^NW\d{7}$/`  
     - **Feedback Sheet URL** must be a valid URL  
   - On form submit: calls `updateDoc` to set  
     `{ employeeId, feedbackSheetUrl, hasCompletedSetup: true }`  
   - Then navigates to `/` (main dashboard)

---

### 2. AI Feedback Dashboard Flow

1. **Frontend Request**  
   - Admin UI calls `getFeedbackSummary` Cloud Function with  
     `{ uid, filterParams }`

2. **Cloud Function Processing**  
   1. **Authorization**: verifies `isAdmin` claim  
   2. **Fetch URL**: reads `employees/{uid}` to get `feedbackSheetUrl`  
   3. **Sheets API**: authenticates via Service Account to pull sheet data  
   4. **Parse & Filter**: uses date-fns to parse timestamps and apply filters  
      (`isSameDay`, `isSameMonth`, or custom range)  
   5. **Aggregate**: computes average ratings and prepares datasets for charts  
   6. **AI Analysis**: sends comments to the Gemini 1.5 Flash API with a structured prompt; parses the JSON response  
   7. **Bundle Response**: returns a single JSON payload containing chart data and AI summaries

3. **Frontend Rendering**  
   - React receives the payload, updates state, and renders:  
     - **Summary Cards** (positive quotes & improvement themes)  
     - **Charts** (bar for single-period, line for trends)

## Getting Started: Local Setup

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud CLI

### 1. Clone the Repository
```bash
git clone https://github.com/hemanthbilla-official/stand-sync.git
cd stand-sync
```

### 2. Frontend Setup
- Install Dependencies:
  ```bash
  npm install
  ```
- Create Environment File: In the project root, create a file named `.env.local`
- Add Firebase Keys: Populate `.env.local` with your Firebase project configuration keys, prefixed with `VITE_`:
  ```
  VITE_FIREBASE_API_KEY="YOUR_API_KEY"
  VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
  # ... etc.
  ```

### 3. Backend Setup
- Install Function Dependencies:
  ```bash
  cd functions
  npm install
  cd ..
  ```
- Set API Key & Service Account Secrets:
  
  a. Get a Gemini API key from Google AI Studio  
  b. Create a dedicated Service Account in Google Cloud with the Editor role and download its JSON key file  
  c. Run these commands from the project root:
  ```bash
  firebase functions:secrets:set GEMINI_KEY
  # (Paste your Gemini key when prompted)
  
  firebase functions:secrets:set SHEETS_SA_KEY --data-file="C:/path/to/your/service-account-key.json"
  ```

### 4. Running the Application
- Start the React App:
  ```bash
  npm run dev
  ```
- Deploy Functions: The AI dashboard requires the functions to be live.
  ```bash
  firebase deploy --only functions
  ```
- Create Your First Admin:
  
  a. Sign up for a new account in your running application  
  b. Complete the new user setup process on the `/setup-profile` page  
  c. Create a `set-admin.cjs` file in the project root as described in our development process  
  d. Run the script to promote the user:
  ```bash
  node set-admin.cjs your-admin-email@example.com
  ```

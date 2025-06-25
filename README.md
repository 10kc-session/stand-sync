# Standup-Sync: AI-Powered Feedback and Attendance Platform

**Standup-Sync** is a modern, full-stack web application designed to streamline team standup meetings and provide deep, AI-driven insights into employee feedback. The platform features distinct roles for Team Members and Admins, a secure authentication system, real-time attendance tracking, and an advanced AI dashboard for analyzing employee sentiment and performance.

This project has been fully migrated from a Supabase backend to a robust, scalable, and secure architecture built entirely on Google's Firebase platform.

## Core Features

### For All Users

* **Secure Authentication:** Users can sign up and log in via Email/Password or a Google account. The system includes email verification and a "Forgot Password" flow.
* **Profile Management:** Logged-in users can update their display name and profile picture.
* **Real-time Standup View:** Users can see if a standup is scheduled for the day and view the attendance status after it's completed.
* **Attendance Streak:** A personalized dashboard on the home page tracks each user's consecutive "Present" streak.

### For Admins

* **Admin Dashboard:** A central hub showing a summary of the day's standup and attendance count.
* **Secure Role-Based Access:** The admin system is protected by Firebase Custom Claims. Only authorized users can access admin functionality.
* **Employee Management (CRUD):** Admins can add, view, edit, and delete employee records from the database.
* **Admin Promotion:** An existing admin can securely promote any other registered user to an admin role via a protected Cloud Function.
* **Standup & Attendance Control:** Admins can schedule standups, start the real-time attendance tracking session, and manually edit attendance records if needed.
* **AI-Powered Feedback Dashboard:** The flagship feature. For any employee, an admin can view a detailed dashboard that:

  * Fetches feedback data from a linked Google Sheet.
  * Uses the Gemini 1.5 Flash AI model to analyze and summarize text comments.
  * Displays the top positive feedback and key areas for improvement.
  * Visualizes quantitative data (understanding ratings, instructor ratings) in a clean bar chart.
  * Allows filtering of feedback data by "Today" or "This Month".
* **Google Sheets Integration:** All attendance data can be synced to a Google Sheet with the click of a button for record-keeping and external analysis.

## Technology Stack

This application is built with a modern, type-safe, and scalable technology stack.

### Frontend

* **Framework:** React 18
* **Build Tool:** Vite
* **Language:** TypeScript
* **Routing:** React Router v6
* **UI Components:** shadcn/ui - A collection of beautifully designed, accessible components including Cards, Buttons, Dialogs, Tables, and more.
* **Styling:** Tailwind CSS
* **Data Fetching/State Management:** TanStack Query (React Query) for efficient caching and data synchronization.
* **Charting:** Chart.js with react-chartjs-2 for data visualization.

### Backend & Infrastructure

* **Platform:** Google Firebase
* **Authentication:** Firebase Authentication (including Email/Password, Google Sign-In, and Custom Claims for role management).
* **Database:** Firestore (a NoSQL, document-based database).
* **File Storage:** Firebase Storage (for user profile pictures).
* **Serverless Logic:** Firebase Cloud Functions (v2) written in TypeScript for all secure backend operations.
* **AI Model:** Google's Gemini 1.5 Flash API for natural language processing and text summarization.
* **External Integration:** Google Sheets API for reading feedback data.

## Architecture and Data Flow

The application is architected to be secure and efficient, with a clear separation between the client (React) and the secure backend (Firebase Cloud Functions).

### 1. Authentication Flow

* **User/Admin Sign-In:** All users, including admins, sign in through the main `/auth` page using Firebase Authentication.
* **Role Verification:**

  * The `UserAuthContext` listens for the basic login state.
  * The `AdminAuthContext` listens to the `UserAuthContext`. When a user logs in, it checks their Firebase ID Token for a custom claim: `{ isAdmin: true }`.
  * If the claim exists, the admin state is populated, granting access to protected admin routes.

### 2. AI Feedback Dashboard Flow (The "Biggest Task")

This is the most complex data flow in the application:

* **Frontend Request:** An admin navigates to an employee's detail page. The React component calls the `getFeedbackSummary` Cloud Function, sending the `employeeId` and a timeframe (daily or monthly).
* **Backend Processing (Cloud Function):**

  1. **Authorization:** Verifies the caller is an authenticated admin.
  2. **Get Sheet URL:** Reads the `employees` collection in Firestore to find the `feedback_sheet_url` for the employee.
  3. **Fetch Sheet Data:** Uses the Google Sheets API to connect to that URL and download feedback data.
  4. **Filter & Parse:** Filters rows based on timeframe and parses numeric ratings.
  5. **Aggregate:** Calculates feedback totals and average scores.
  6. **AI Analysis:** Sends text comments to Gemini API for structured JSON summary.
  7. **Clean & Respond:** Cleans AI output and bundles data into JSON response.
* **Frontend Rendering:** React component updates state and renders summary cards and charts.

## Data Models (Firestore)

* **employees:**

  * `name`, `email`, `feedback_sheet_url`

* **standups:**

  * `scheduled_at`, `created_at`, `created_by`

* **attendance:**

  * `standup_id`, `employee_id`, `status`, `scheduled_at`

## Getting Started: Local Setup

To set up and run this project on your local machine, follow these steps.

### Prerequisites

* Node.js (v18 or later)
* npm or yarn
* Firebase CLI (`npm install -g firebase-tools`)
* Google Cloud CLI

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/hemanthbilla-official/stand-sync.git
   cd standup-sync-react
   ```

2. **Frontend Setup**

   ```bash
   npm install
   ```

   Create `.env.local` with Firebase keys:

   ```
   VITE_FIREBASE_API_KEY="YOUR_API_KEY"
   VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
   ```

3. **Backend Setup**

   ```bash
   firebase init functions
   cd functions
   npm install googleapis google-auth-library @google/generative-ai
   cd ..
   firebase functions:secrets:set GEMINI_KEY
   ```

4. **Running the Application**

   ```bash
   npm run dev
   firebase deploy --only functions
   ```

   Create admin:

   ```bash
   npm install -D ts-node
   node --loader ts-node/esm set-admin.ts your-email@example.com
   ```

The application is now ready for local use.

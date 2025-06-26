# Standup-Sync: AI-Powered Feedback and Attendance Platform

Standup-Sync is a modern, full-stack web application designed to streamline team standup meetings and provide deep, AI-driven insights into employee feedback. The platform features distinct roles for Team Members and Admins, a secure authentication system, real-time attendance tracking, and an advanced AI dashboard for analyzing employee sentiment and performance.
This project was successfully migrated from a Supabase backend to a robust, scalable, and secure architecture built entirely on Google's Firebase platform.

---

## Core Features

### For All Users

* **Secure Authentication:** Users can sign up and log in via Email/Password or a Google account. The system includes email verification and a "Forgot Password" flow.
* **Profile Management:** Logged-in users can update their display name and profile picture through a dedicated profile editor.

### For Team Members

* **Personalized Dashboard:** A home page that displays a user's consecutive attendance streak.
* **Standup Participation:** View daily standup status and attendance records.

### For Admins

* **Admin Dashboard:** A central hub showing a summary of the day's standup, total attendance, and other key metrics.
* **Secure Role-Based Access:** The admin system is protected by Firebase Custom Claims. Only authorized users can access admin functionality.
* **Employee Management (CRUD):** Admins can add, view, edit (inline), and delete employee records from the database, including assigning a unique feedback Google Sheet URL to each employee.
* **Admin Promotion:** An existing admin can securely promote any other registered user to an admin role via a protected Cloud Function.
* **Standup & Attendance Control:** Admins can schedule standups, start the real-time attendance tracking session, and manually edit attendance records if needed.
* **AI-Powered Feedback Dashboard:** The flagship feature. For any employee, an admin can view a detailed dashboard that:

  * Fetches feedback data from that employee's private, restricted-access Google Sheet.
  * Uses the Gemini 1.5 Flash AI model to analyze and summarize text comments into structured insights.
  * Displays Positive Feedback (as quotes with keywords) and actionable Areas for Improvement (as themes with suggestions).
  * Visualizes quantitative data in two ways:

    * A Bar Chart for single-point summaries (Today, Specific Day, This Month).
    * A Line Chart to show feedback trends over a selected date range or the full history.
  * Allows filtering of feedback data by "Today," a specific month/year, a custom date range, or the entire sheet history.
* **Google Sheets Integration:** All attendance data can be synced to a separate Google Sheet with the click of a button for record-keeping.

---

## Technology Stack

### Frontend

* **Framework:** React 18
* **Build Tool:** Vite
* **Language:** TypeScript
* **Routing:** React Router v6
* **UI Components:** shadcn/ui - A collection of beautifully designed, accessible components including Cards, Buttons, Dialogs, Tables, and more.
* **Styling:** Tailwind CSS
* **State Management (Client):** React Context API for authentication state.
* **Charting:** Chart.js with react-chartjs-2 for data visualization.
* **Date Handling:** date-fns for robust, timezone-proof date manipulation.

### Backend & Infrastructure

* **Platform:** Google Firebase
* **Authentication:** Firebase Authentication (including Email/Password, Google Sign-In, and Custom Claims for role management).
* **Database:** Firestore (a NoSQL, document-based database).
* **File Storage:** Firebase Storage (for user profile pictures).
* **Serverless Logic:** Firebase Cloud Functions (v2) written in TypeScript for all secure backend operations.
* **AI Model:** Google's Gemini 1.5 Flash API for natural language processing and text summarization.
* **External Integration:** Google Sheets API, authenticated via a dedicated Service Account for secure, restricted access.

---

## Architecture and Data Flow

The application is architected to be secure and efficient, with a clear separation between the client (React) and the secure backend (Firebase Cloud Functions).

### 1. Authentication Flow

1. **User/Admin Sign-In:** All users, including admins, sign in through the main `/auth` page using Firebase Authentication.
2. **Role Verification:**

   * The **UserAuthContext** listens for the basic login state.
   * The **AdminAuthContext** listens to the UserAuthContext. When a user logs in, it forces a refresh of their Firebase ID Token and checks for a custom claim: `{ isAdmin: true }`.
   * If the claim exists, the admin state is populated, granting access to protected admin routes.

### 2. AI Feedback Dashboard Flow

This is the most complex data flow in the application:

1. **Frontend Request:** An admin selects an employee and a filter (e.g., "This Month"). The React component calls the `getFeedbackSummary` Cloud Function, sending the `employeeId` and the filter parameters.
2. **Backend Processing (Cloud Function):**
   a. **Authorization:** The function first verifies that the caller is an authenticated admin.
   b. **Get Sheet URL:** It reads the `employees` collection in Firestore to find the `feedback_sheet_url` for the specified employee.
   c. **Securely Authenticate to Sheets:** It uses a dedicated, downloaded Service Account Key (`SHEETS_SA_KEY` secret) to authenticate with the Google Sheets API. This is the only identity that has "Viewer" access to the private sheets.
   d. **Fetch & Parse Data:** It fetches the raw data from the sheet and uses the `date-fns` library to reliably parse the `mm/dd/yyyy hh:mm:ss` date format.
   e. **Filter Data:** It applies the correct, timezone-proof filter based on the admin's request (e.g., `isSameDay`, `isSameMonth`).
   f. **Aggregate & Process:** It calculates the average ratings and prepares data for either a bar chart (for single periods) or a line chart (for ranges).
   g. **AI Analysis:** It bundles the text comments and sends them to the Gemini API with a detailed prompt, asking for a structured JSON response.
   h. **Clean & Respond:** It cleans the AI's response (to remove markdown formatting) and bundles all the processed data (AI summary + graph data) into a single JSON object.
3. **Frontend Rendering:** The React component receives the clean JSON object and uses it to update its state, rendering the AI summary cards and the correct chart.

---

## Getting Started: Local Setup

To set up and run this project on your local machine, follow these steps.

### Prerequisites

* **Node.js** (v18 or later)
* **npm** or **yarn**
* **Firebase CLI** (`npm install -g firebase-tools`)
* **Google Cloud CLI** (for setting up Storage CORS rules)

### 1. Clone the Repository

```bash
git clone https://github.com/hemanthbilla-official/stand-sync.git
cd stand-sync
```

### 2. Frontend Setup

* **Install Dependencies:**

  ```bash
  npm install
  ```
* **Create Environment File:** In the root of the project, create a file named `.env.local`.
* **Add Firebase Keys:** Populate `.env.local` with your Firebase project configuration keys, prefixed with `VITE_`.

  ```bash
  VITE_FIREBASE_API_KEY="YOUR_API_KEY"
  VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
  # ... and so on for all keys
  ```

### 3. Backend Setup

* **Install Function Dependencies:**

  ```bash
  cd functions
  npm install
  cd ..
  ```
* **Set API Key & Service Account Secrets:**
  a. Get a Gemini API key from Google AI Studio.
  b. Create a dedicated Service Account in Google Cloud with the "Editor" role and download its JSON key file.
  c. Run the following commands from the project root, replacing the path with the location of your downloaded key file:

  ```bash
  firebase functions:secrets:set GEMINI_KEY
  # (Paste your Gemini key when prompted)

  firebase functions:secrets:set SHEETS_SA_KEY --data-file="C:/path/to/your/service-account-key.json"
  ```

### 4. Running the Application

* **Start the React App:**

  ```bash
  npm run dev
  ```
* **Deploy Functions:** The AI dashboard requires the functions to be live.

  ```bash
  firebase deploy --only functions
  ```
* **Create Your First Admin:**
  a. Sign up for a new account in your running application.
  b. Create a `set-admin.cjs` file in the project root as described in our development process.
  c. Run the script to promote the user:

  ```bash
  node set-admin.cjs your-email@example.com
  ```

You are now ready to use the application fully on your local machine.

// src/pages/NotFound.tsx

/**
 * Renders a 404 Not Found page for routes that do not exist in the application.
 * Logs an error to the console when a user attempts to access a non-existent route.
 *
 * @returns {JSX.Element} The rendered 404 Not Found page with a link to return to the home page.
 *
 * @remarks
 * - Uses `useLocation` to access the current route and logs the attempted path.
 * - Provides a user-friendly message and navigation back to the home page.
 */

import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <Link
          to="/"
          className="text-blue-500 hover:text-blue-700 underline"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}

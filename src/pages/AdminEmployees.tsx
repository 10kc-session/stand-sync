/**
 * AdminEmployees page component for managing employee records in the admin dashboard.
 *
 * Features:
 * - Displays a searchable, sortable list of employees.
 * - Allows inline editing of employee details (name, email, employeeId, feedbackSheetUrl).
 * - Supports promoting an employee to admin via Firebase Cloud Function.
 * - Supports deleting an employee (removes both Firestore profile and Auth account).
 * - Provides UI feedback for loading, errors, and actions using toasts.
 * - Uses Firebase Firestore for data storage and retrieval.
 * - Uses React Router for navigation and protected route logic.
 * - Responsive and accessible UI with support for dark mode.
 *
 * @component
 * @returns {JSX.Element} The rendered AdminEmployees page.
 *
 * @remarks
 * - Only accessible to authenticated admins.
 * - Employee list is fetched from the "employees" Firestore collection.
 * - Promoting to admin and deleting employees are irreversible actions.
 * - Inline editing is available in "Edit Mode".
 *
 * @see {@link useAdminAuth} for admin authentication context.
 * @see {@link fetchEmployees} for Firestore data fetching logic.
 * @see {@link updateEmployee} for Firestore update logic.
 * @see {@link handleMakeAdmin} for admin promotion logic.
 * @see {@link handleDeleteEmployee} for employee deletion logic.
 */
// src/pages/AdminEmployees.tsx

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AppNavbar from "@/components/AppNavbar";
import { Edit, Trash2, Check, X, Loader2, ShieldCheck, Search, Link2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

import { db } from "@/integrations/firebase/client";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { motion } from "framer-motion";


type Employee = {
  id: string;
  name: string;
  email: string;
  employeeId?: string; // The "NW..." ID
  feedbackSheetUrl?: string;
};

type EditableEmployeeData = {
  name: string;
  email: string;
  employeeId?: string;
  feedbackSheetUrl?: string;
};

const fetchEmployees = async (): Promise<Employee[]> => {
  const employeesCollection = collection(db, "employees");
  const q = query(employeesCollection, orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Employee)
  );
};

const updateEmployee = async (id: string, employee: EditableEmployeeData): Promise<void> => {
  const employeeDocRef = doc(db, "employees", id);
  await updateDoc(employeeDocRef, employee);
};

const deleteEmployee = async (id: string): Promise<void> => {
  const employeeDocRef = doc(db, "employees", id);
  await deleteDoc(employeeDocRef);
};


export default function AdminEmployees() {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<Employee[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [searchQuery, setSearchQuery] = React.useState("");

  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  // --- CHANGED: The state for form data now includes employeeId ---
  const [editFormData, setEditFormData] = React.useState<{ [key: string]: EditableEmployeeData; }>({});
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isPromoting, setIsPromoting] = React.useState(false);

  const loadEmployees = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchEmployees()
      .then(setEmployees)
      .catch((e) => setError(e.message || "Error fetching employees"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (!admin) {
      navigate("/admin/login");
      return;
    }
    loadEmployees();
  }, [admin, navigate, loadEmployees]);


  const handleMakeAdmin = async (email: string, name: string) => {
    // This function requires a confirmation dialog in a real app
    setIsPromoting(true);
    try {
      const functions = getFunctions();
      const addAdminRoleCallable = httpsCallable(functions, 'addAdminRole');
      const result = await addAdminRoleCallable({ email: email });
      toast({
        title: "Success",
        description: (result.data as any).message,
        className: "bg-blue-500 text-white",
      });
    } catch (error: any) {
      console.error("Error making admin:", error);
      toast({
        title: "Error making admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  // --- REMOVED: handleAddEmployee function ---

  const startInlineEdit = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEditFormData((prev) => ({
      ...prev,
      [employee.id]: {
        name: employee.name,
        email: employee.email,
        employeeId: employee.employeeId || "",
        feedbackSheetUrl: employee.feedbackSheetUrl || ""
      },
    }));
  };

  const cancelInlineEdit = (employeeId: string) => {
    setEditingEmployeeId(null);
    setEditFormData((prev) => {
      const newData = { ...prev };
      delete newData[employeeId];
      return newData;
    });
  };

  const updateInlineField = (
    employeeId: string,
    field: "name" | "email" | "employeeId" | "feedbackSheetUrl",
    value: string
  ) => {
    setEditFormData((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const handleSaveInlineEdit = async (employeeId: string) => {
    const employeeData = editFormData[employeeId];
    if (!employeeData || !employeeData.name.trim() || !employeeData.email.trim()) {
      toast({
        title: "Error",
        description: "Name and Email fields are required",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateEmployee(employeeId, employeeData);
      toast({
        title: "Success",
        description: "Employee updated successfully!",
        className: "bg-green-500 text-white",
      });
      setEditingEmployeeId(null);
      setEditFormData((prev) => {
        const newData = { ...prev };
        delete newData[employeeId];
        return newData;
      });
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  async function handleDeleteEmployee(uid: string) {
    setDeletingId(uid);
    try {
      const functions = getFunctions();
      const deleteEmp = httpsCallable(functions, "deleteEmployee");
      await deleteEmp({ uid });
      toast({
        title: "Success",
        description: "User account and profile deleted.",
        className: "bg-green-500 text-white",
      });
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setEditingEmployeeId(null);
    setEditFormData({});
  };

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    if (!searchQuery) return employees;

    const lowercasedQuery = searchQuery.toLowerCase();
    // --- CHANGED: Allow searching by employeeId as well ---
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(lowercasedQuery) ||
      emp.email.toLowerCase().includes(lowercasedQuery) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(lowercasedQuery))
    );
  }, [employees, searchQuery]);
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 flex flex-col items-center py-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-6xl"
        >
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Manage Employees {filteredEmployees ? `(${filteredEmployees.length})` : ""}
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant={isEditMode ? "default" : "outline"} onClick={toggleEditMode}>
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditMode ? "Exit Edit Mode" : "Edit Employees"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/admin")}>Back</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading...</span>
                </div>
              )}
              {error && <div className="text-red-600 p-4 rounded-md bg-red-50">{error}</div>}
              {employees && (
                <div className="overflow-x-auto rounded-md border mt-4">
                  <table className="w-full caption-bottom text-sm">
                    <caption className="sr-only">List of employees</caption>
                    <thead className="[&_tr]:border-b">
                      <tr className="bg-muted/40 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        {/* --- ADDED: New column header for Employee ID --- */}
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Employee ID</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Feedback Sheet URL</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {filteredEmployees.length === 0 ? (
                        <TableRow>
                          {/* --- CHANGED: colSpan is now 5 to account for the new column --- */}
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No employees found. New users will appear here after they sign up.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <TableRow key={emp.id} className="border-b transition-colors hover:bg-muted/50">
                            <TableCell className="p-4 align-middle font-medium">
                              {editingEmployeeId === emp.id ? (
                                <Input value={editFormData[emp.id]?.name || ""}
                                  onChange={(e) => updateInlineField(emp.id, "name", e.target.value)}
                                  className="h-8" />
                              ) : (
                                <Link to={`/admin/employees/${emp.id}`} className="text-primary hover:underline">
                                  {emp.name}
                                </Link>
                              )}
                            </TableCell>

                            {/* --- ADDED: New table cell for Employee ID --- */}
                            <TableCell className="p-4 align-middle">
                              {editingEmployeeId === emp.id ? (
                                <Input value={editFormData[emp.id]?.employeeId || ""}
                                  onChange={(e) => updateInlineField(emp.id, "employeeId", e.target.value)}
                                  className="h-8" placeholder="NW..." />
                              ) : (
                                <span className="font-mono text-xs">{emp.employeeId || "Not Set"}</span>
                              )}
                            </TableCell>

                            <TableCell className="p-4 align-middle">
                              {editingEmployeeId === emp.id ? (
                                <Input type="email" value={editFormData[emp.id]?.email || ""}
                                  onChange={(e) => updateInlineField(emp.id, "email", e.target.value)}
                                  className="h-8" />
                              ) : (
                                <span>{emp.email}</span>
                              )}
                            </TableCell>
                            <TableCell className="p-4 align-middle">
                              {editingEmployeeId === emp.id ? (
                                <Input type="url" value={editFormData[emp.id]?.feedbackSheetUrl || ""}
                                  onChange={(e) => updateInlineField(emp.id, "feedbackSheetUrl", e.target.value)}
                                  className="h-8" placeholder="https://..." />
                              ) : (
                                emp.feedbackSheetUrl ? (
                                  <a href={emp.feedbackSheetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                                    <Link2 className="h-3 w-3" />
                                    <span>Open Link</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not Set</span>
                                )
                              )}
                            </TableCell>
                            <TableCell className="p-4 align-middle">
                              <div className="flex justify-end gap-2">
                                {isEditMode && (
                                  <>
                                    {editingEmployeeId === emp.id ? (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => cancelInlineEdit(emp.id)}> <X className="h-4 w-4" /></Button>
                                        <Button size="sm" onClick={() => handleSaveInlineEdit(emp.id)} disabled={isUpdating}>
                                          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        </Button>
                                      </>
                                    ) : (
                                      <Button size="sm" variant="outline" onClick={() => startInlineEdit(emp)}><Edit className="h-4 w-4" /></Button>
                                    )}
                                  </>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-purple-600 border-purple-600 hover:bg-purple-100 hover:text-purple-700">
                                      <ShieldCheck className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Make {emp.name} an Admin?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will grant admin privileges to {emp.email}. This user must have already signed up for an account. This action is irreversible through the UI.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleMakeAdmin(emp.email, emp.name)} disabled={isPromoting}>
                                        {isPromoting ? "Promoting..." : "Promote to Admin"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={deletingId === emp.id}
                                      className="border-red-600 hover:bg-red-100 hover:text-red-700"
                                    >
                                      {deletingId === emp.id
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                  </AlertDialogTrigger>

                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                      <AlertDialogDescription>This will permanently delete {emp.name}.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteEmployee(emp.id)}
                                        disabled={deletingId === emp.id}
                                        className="bg-destructive hover:bg-destructive/90 flex items-center justify-center"
                                      >
                                        {deletingId === emp.id
                                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          : <Trash2 className="h-4 w-4 mr-2" />}
                                        {deletingId === emp.id ? "Deleting…" : "Delete"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
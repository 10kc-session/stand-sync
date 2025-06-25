import React from "react";
// --- CHANGE 1: Import the Link component ---
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Edit, Trash2, Plus, Check, X, Loader2, ShieldCheck } from "lucide-react";

import { db } from "@/integrations/firebase/client";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

type Employee = {
  id: string;
  name: string;
  email: string;
};

const fetchEmployees = async (): Promise<Employee[]> => {
  const employeesCollection = collection(db, "employees");
  const q = query(employeesCollection, orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Employee)
  );
};

const addEmployee = async (employee: { name: string; email: string }): Promise<void> => {
  await addDoc(collection(db, "employees"), employee);
};

const updateEmployee = async (
  id: string,
  employee: { name: string; email: string }
): Promise<void> => {
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
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [addFormData, setAddFormData] = React.useState({ name: "", email: "" });
  const [isAdding, setIsAdding] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  const [editFormData, setEditFormData] = React.useState<{ [key: string]: { name: string; email: string }; }>({});
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
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
    if (!window.confirm(`Are you sure you want to make ${name} (${email}) an admin? This user must have already signed up for an account.`)) {
      return;
    }
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

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.name.trim() || !addFormData.email.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    setIsAdding(true);
    try {
      await addEmployee(addFormData);
      toast({
        title: "Success",
        description: "Employee added successfully!",
        className: "bg-green-500 text-white",
      });
      setAddFormData({ name: "", email: "" });
      setIsAddDialogOpen(false);
      loadEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add employee",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const startInlineEdit = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setEditFormData((prev) => ({
      ...prev,
      [employee.id]: { name: employee.name, email: employee.email },
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
    field: "name" | "email",
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
        description: "Please fill in all fields",
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

  const handleDeleteEmployee = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteEmployee(id);
      toast({
        title: "Success",
        description: "Employee deleted successfully!",
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
      setIsDeleting(false);
    }
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setEditingEmployeeId(null);
    setEditFormData({});
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 flex flex-col items-center py-10 px-4">
        <Card className="w-full max-w-5xl shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                Manage Employees {employees ? `(${employees.length})` : ""}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="min-w-[150px] bg-green-600 hover:bg-green-700 text-white transition-colors"
                      aria-label="Add new employee"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Employee
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold">
                        Add New Employee
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddEmployee} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="employee-name" className="block">
                          Employee Name
                        </Label>
                        <Input
                          id="employee-name"
                          placeholder="John Doe"
                          value={addFormData.name}
                          onChange={(e) =>
                            setAddFormData({
                              ...addFormData,
                              name: e.target.value,
                            })
                          }
                          required
                          aria-required="true"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employee-email" className="block">
                          Email Address
                        </Label>
                        <Input
                          id="employee-email"
                          type="email"
                          placeholder="john@example.com"
                          value={addFormData.email}
                          onChange={(e) =>
                            setAddFormData({
                              ...addFormData,
                              email: e.target.value,
                            })
                          }
                          required
                          aria-required="true"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddDialogOpen(false);
                            setAddFormData({ name: "", email: "" });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isAdding}
                          className="min-w-[120px]"
                        >
                          {isAdding ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            "Add Employee"
                          )}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  disabled={!employees || employees.length === 0}
                  onClick={toggleEditMode}
                  aria-pressed={isEditMode}
                  aria-label={
                    isEditMode ? "Exit edit mode" : "Enable edit mode"
                  }
                  className={
                    isEditMode
                      ? "bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      : "hover:bg-muted hover:text-primary transition-colors"
                  }
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditMode ? "Exit Edit Mode" : "Edit Employees"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  aria-label="Go back to admin dashboard"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="sr-only">Loading employees...</span>
                <span className="ml-2">Loading employees...</span>
              </div>
            )}

            {error && (
              <div
                className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-md mb-4"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            {employees && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">List of employees</caption>
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th
                        scope="col"
                        className="text-left px-4 py-3 font-medium text-gray-900 dark:text-white"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="text-left px-4 py-3 font-medium text-gray-900 dark:text-white"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="text-right px-4 py-3 font-medium text-gray-900 dark:text-white"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {editingEmployeeId === emp.id ? (
                            <div className="space-y-1">
                              <Label
                                htmlFor={`name-${emp.id}`}
                                className="sr-only"
                              >
                                Name
                              </Label>
                              <Input
                                id={`name-${emp.id}`}
                                value={editFormData[emp.id]?.name || emp.name}
                                onChange={(e) =>
                                  updateInlineField(
                                    emp.id,
                                    "name",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-sm"
                                placeholder="Employee Name"
                                aria-label="Edit employee name"
                              />
                            </div>
                          ) : (
                            // --- CHANGE 2: Wrap the employee name in a Link component ---
                            <Link to={`/admin/employees/${emp.id}`} className="font-medium text-primary hover:underline">
                              {emp.name}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingEmployeeId === emp.id ? (
                            <div className="space-y-1">
                              <Label
                                htmlFor={`email-${emp.id}`}
                                className="sr-only"
                              >
                                Email
                              </Label>
                              <Input
                                id={`email-${emp.id}`}
                                type="email"
                                value={editFormData[emp.id]?.email || emp.email}
                                onChange={(e) =>
                                  updateInlineField(
                                    emp.id,
                                    "email",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-sm"
                                placeholder="Employee Email"
                                aria-label="Edit employee email"
                              />
                            </div>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              {emp.email}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {isEditMode && (
                              <>
                                {editingEmployeeId === emp.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => cancelInlineEdit(emp.id)}
                                      aria-label="Cancel editing"
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleSaveInlineEdit(emp.id)
                                      }
                                      disabled={isUpdating}
                                      aria-label="Save changes"
                                    >
                                      {isUpdating ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4 mr-1" />
                                          Save
                                        </>
                                      )}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startInlineEdit(emp)}
                                    aria-label={`Edit ${emp.name}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-purple-600 border-purple-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-50"
                              onClick={() => handleMakeAdmin(emp.email, emp.name)}
                              disabled={isPromoting}
                              aria-label={`Make ${emp.name} an admin`}
                            >
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              Make Admin
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  aria-label={`Delete ${emp.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-lg">
                                    Are you absolutely sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete{" "}
                                    <span className="font-semibold">
                                      {emp.name}
                                    </span>{" "}
                                    from the database.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="mt-0">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteEmployee(emp.id)}
                                    disabled={isDeleting}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    {isDeleting ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      "Delete"
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {employees && employees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-gray-500 dark:text-gray-400">
                  No employees found. Click "Add Employee" to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
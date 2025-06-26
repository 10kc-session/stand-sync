import React from "react";
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
import { Edit, Trash2, Plus, Check, X, Loader2, ShieldCheck, Search, Link2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table"; // <-- Add this line

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
import { motion } from "framer-motion"; // Import motion for animations


type Employee = {
  id: string;
  name: string;
  email: string;
  feedback_sheet_url?: string;
};

const fetchEmployees = async (): Promise<Employee[]> => {
  const employeesCollection = collection(db, "employees");
  const q = query(employeesCollection, orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Employee)
  );
};

const addEmployee = async (employee: { name: string; email: string; feedback_sheet_url?: string }): Promise<void> => {
  await addDoc(collection(db, "employees"), employee);
};

const updateEmployee = async (
  id: string,
  employee: { name: string; email: string; feedback_sheet_url?: string }
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

  const [searchQuery, setSearchQuery] = React.useState("");

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const initialFormData = { name: "", email: "", feedback_sheet_url: "" };
  const [addFormData, setAddFormData] = React.useState(initialFormData);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  const [editFormData, setEditFormData] = React.useState<{ [key: string]: { name: string; email: string; feedback_sheet_url?: string }; }>({});
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
        description: "Please fill in all fields (Sheet URL is optional)",
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
      setAddFormData(initialFormData);
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
      [employee.id]: {
        name: employee.name,
        email: employee.email,
        feedback_sheet_url: employee.feedback_sheet_url || ""
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
    field: "name" | "email" | "feedback_sheet_url",
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

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    if (!searchQuery) return employees;

    const lowercasedQuery = searchQuery.toLowerCase();
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(lowercasedQuery) ||
      emp.email.toLowerCase().includes(lowercasedQuery)
    );
  }, [employees, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <main className="flex-1 flex flex-col items-center py-10 px-4">
        {/* Added motion.div for the entrance animation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-6xl" // These classes apply to the motion.div wrapper
        >
          <Card className="shadow-sm"> {/* Card now only receives shadow-sm */}
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Manage Employees {filteredEmployees ? `(${filteredEmployees.length})` : ""}
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
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
                        <Label htmlFor="employee-name">Employee Name</Label>
                        <Input id="employee-name" value={addFormData.name}
                          onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employee-email">Email Address</Label>
                        <Input id="employee-email" type="email" value={addFormData.email}
                          onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="feedback-sheet-url">Feedback Sheet URL (Optional)</Label>
                        <Input id="feedback-sheet-url" type="url" placeholder="https://docs.google.com/spreadsheets/..." value={addFormData.feedback_sheet_url}
                          onChange={(e) => setAddFormData({ ...addFormData, feedback_sheet_url: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isAdding}>
                          {isAdding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : "Add Employee"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
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
                <div className="overflow-x-auto rounded-md border mt-4"> {/* Added border and rounded-md */}
                  <table className="w-full caption-bottom text-sm"> {/* Changed to shadcn/ui Table structure */}
                    <caption className="sr-only">List of employees</caption>
                    <thead className="[&_tr]:border-b"> {/* Uses shadcn/ui TableHead structure */}
                      <tr className="bg-muted/40 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-1/4">Name</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-1/4">Email</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-1/4">Feedback Sheet URL</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-1/4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0"> {/* Uses shadcn/ui TableBody structure */}
                      {filteredEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No employees found matching your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <TableRow key={emp.id} className="border-b transition-colors hover:bg-muted/50">
                            <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                              {editingEmployeeId === emp.id ? (
                                <Input value={editFormData[emp.id]?.name || ""}
                                  onChange={(e) => updateInlineField(emp.id, "name", e.target.value)}
                                  className="h-8" />
                              ) : (
                                <Link to={`/admin/employees/${emp.id}`} className="font-medium text-primary hover:underline">
                                  {emp.name}
                                </Link>
                              )}
                            </TableCell>
                            <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                              {editingEmployeeId === emp.id ? (
                                <Input type="email" value={editFormData[emp.id]?.email || ""}
                                  onChange={(e) => updateInlineField(emp.id, "email", e.target.value)}
                                  className="h-8" />
                              ) : (
                                <span>{emp.email}</span>
                              )}
                            </TableCell>
                            <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                              {editingEmployeeId === emp.id ? (
                                <Input type="url" value={editFormData[emp.id]?.feedback_sheet_url || ""}
                                  onChange={(e) => updateInlineField(emp.id, "feedback_sheet_url", e.target.value)}
                                  className="h-8" placeholder="https://..." />
                              ) : (
                                emp.feedback_sheet_url ? (
                                  <a href={emp.feedback_sheet_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                                    <Link2 className="h-3 w-3" />
                                    <span>Open Link</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not Available</span>
                                )
                              )}
                            </TableCell>
                            <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
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
                                <Button size="sm" variant="outline" className="text-purple-600 border-purple-600" onClick={() => handleMakeAdmin(emp.email, emp.name)} disabled={isPromoting}><ShieldCheck className="h-4 w-4" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                      <AlertDialogDescription>This will permanently delete {emp.name}.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteEmployee(emp.id)} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                        {isDeleting ? "Deleting..." : "Delete"}
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
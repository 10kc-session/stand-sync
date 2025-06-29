/**
 * Employees page component for managing and displaying a list of employees.
 *
 * - Fetches employees from the Firestore "employees" collection, ordered by name.
 * - Allows adding new employees via a form, which updates Firestore and refreshes the list.
 * - Uses React Query for data fetching and mutation, and react-hook-form for form handling.
 * - Displays feedback using a toast notification system.
 *
 * @component
 * @returns {JSX.Element} The rendered Employees management page.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";

// --- Firebase Imports ---
import { db } from "@/integrations/firebase/client";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";

// Type definition remains the same
type Employee = {
  id: string;
  name: string;
  email: string;
};

export default function Employees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- CHANGE 1: queryFn now uses Firestore ---
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const employeesCollection = collection(db, "employees");
      const q = query(employeesCollection, orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      // Map the Firestore documents to our Employee type, including the ID
      return querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Employee)
      );
    },
  });

  // --- CHANGE 2: mutationFn now uses Firestore ---
  const { mutate: addEmployee, isPending } = useMutation({
    mutationFn: async (values: { name: string; email: string }) => {
      // Add a new document to the "employees" collection in Firestore
      await addDoc(collection(db, "employees"), values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Employee added!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Form handling logic remains the same
  const { register, handleSubmit, reset } = useForm<{
    name: string;
    email: string;
  }>();

  function onSubmit(values: { name: string; email: string }) {
    addEmployee(values, {
      onSuccess: () => reset(),
    });
  }

  // JSX remains the same
  return (
    <div className="max-w-xl mx-auto my-10">
      <Card>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Input
              placeholder="Name"
              {...register("name", { required: true })}
            />
            <Input
              placeholder="Email"
              type="email"
              {...register("email", { required: true })}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Employee"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : employees?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-muted-foreground">No employees yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
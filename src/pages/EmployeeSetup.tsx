// src/pages/EmployeeSetup.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useUserAuth } from '@/context/UserAuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function EmployeeSetup() {
    const { user } = useUserAuth();
    const navigate = useNavigate();

    const [employeeId, setEmployeeId] = useState('');
    const [sheetLink, setSheetLink] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const isEmployeeIdValid = (id: string) => {
        const regex = /^NW\d{7}$/;
        return regex.test(id);
    };

    const isSheetLinkValid = (link: string) => {
        try {
            new URL(link);
            return true;
        } catch (_) {
            return false;
        }
    };

    const isFormValid = isEmployeeIdValid(employeeId) && isSheetLinkValid(sheetLink);

    const handleEmployeeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const upperCaseValue = e.target.value.toUpperCase();
        setEmployeeId(upperCaseValue);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || !user) {
            setError('Please ensure all fields are valid.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // --- MODIFIED: Pointing to the 'employees' collection ---
            const employeeDocRef = doc(db, 'employees', user.uid);
            await updateDoc(employeeDocRef, {
                employeeId: employeeId,
                feedbackSheetUrl: sheetLink,
                hasCompletedSetup: true,
            });
            navigate('/');
        } catch (err) {
            setError('Failed to save details. Please try again.');
            console.error(err);
            setLoading(false);
        }
    };

    // --- The JSX (return statement) for this component remains unchanged ---
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Complete Your Setup</CardTitle>
                    <CardDescription>
                        Please provide your Employee ID and Feedback Sheet link to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="employeeId" className="text-sm font-medium">Employee ID</label>
                            <Input
                                id="employeeId"
                                placeholder="e.g., NW1234567"
                                value={employeeId}
                                onChange={handleEmployeeIdChange}
                                maxLength={9}
                                required
                            />
                            {!isEmployeeIdValid(employeeId) && employeeId.length > 0 && (
                                <p className="text-xs text-destructive">Must be in the format NW followed by 7 numbers.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="sheetLink" className="text-sm font-medium">Feedback Sheet Link</label>
                            <Input
                                id="sheetLink"
                                type="url"
                                placeholder="https://docs.google.com/spreadsheets/..."
                                value={sheetLink}
                                onChange={(e) => setSheetLink(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <Button type="submit" className="w-full" disabled={!isFormValid || loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Get Started
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
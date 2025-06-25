import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";

// Initialize the Admin SDK
admin.initializeApp();

/**
 * Interface for the data we expect to receive in the 'data' property
 * of the request object.
 */
interface AddAdminRoleData {
    email: string;
}

/**
 * Interface to extend the default DecodedIdToken with our custom claim.
 */
interface CustomDecodedIdToken extends DecodedIdToken {
    isAdmin?: boolean;
}

// Define our callable function with the EXACT signature the error wants.
export const addAdminRole = functions.https.onCall(async (request: functions.https.CallableRequest<AddAdminRoleData>) => {
    // --- Security Check 1: User must be authenticated ---
    // Access auth from `request.auth`
    if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be authenticated to call this function.",
        );
    }

    // --- Security Check 2: User must be an Admin ---
    // Access the token from `request.auth.token`
    const token = request.auth.token as CustomDecodedIdToken;
    if (token.isAdmin !== true) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Only an admin can perform this action.",
        );
    }

    // --- Input Validation ---
    // Access the email from `request.data.email`.
    // TypeScript now knows this exists because we typed the request object above.
    const email = request.data.email;
    if (typeof email !== "string" || email.length === 0) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with a valid email address.",
        );
    }

    try {
        const user = await admin.auth().getUserByEmail(email);

        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });

        return {
            message: `Success! ${email} has been made an admin.`,
        };
    } catch (error: unknown) {
        console.error("Error setting custom claim:", error);

        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError(
                "not-found",
                "No user account was found for this email address.",
            );
        }

        throw new functions.https.HttpsError(
            "internal",
            "An unexpected error occurred while processing your request.",
        );
    }
});
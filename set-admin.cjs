/**
 * Script to set a custom admin claim for a Firebase user by email.
 *
 * Usage:
 *   node set-admin.cjs user@example.com
 *
 * This script initializes the Firebase Admin SDK using a service account key,
 * retrieves a user by their email address, and sets a custom claim `{ isAdmin: true }`
 * for that user. The user may need to log out and log back in for the changes to take effect.
 *
 * Arguments:
 *   email {string} - The email address of the user to be made an admin.
 *
 * Exits with code 0 on success, 1 on error.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const email = process.argv[2];

if (!email) {
    console.error("Please provide an email address as an argument.");
    console.log("Usage: node set-admin.cjs user@example.com");
    process.exit(1);
}

(async () => {
    try {
        console.log(`Finding user: ${email}...`);
        const user = await admin.auth().getUserByEmail(email);

        console.log(`Setting custom claim { isAdmin: true } for user ${user.uid}...`);
        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });

        console.log(`\n✅ Success! User ${email} has been made an admin.`);
        console.log("They may need to log out and log back in for the changes to take effect.");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error setting custom claim:", error.message);
        process.exit(1);
    }
})();
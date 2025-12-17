// Firebase configuration for PNPtv Landing Pages
// This file is served to the client browser

// IMPORTANT: Replace these values with your actual Firebase project credentials
// These can be found in Firebase Console -> Project Settings -> General -> Your apps

const firebaseConfig = {
    // Get these values from your Firebase Console
    // Project Settings -> General -> Your apps -> Web app
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Note: These credentials are safe to expose in client-side code
// Firebase security is handled by Firestore security rules
// Make sure to configure proper security rules in Firebase Console

// Example of what the config should look like:
/*
const firebaseConfig = {
    apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "pnptv-project.firebaseapp.com",
    projectId: "pnptv-project",
    storageBucket: "pnptv-project.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
*/

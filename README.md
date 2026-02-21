# Land Plots MVP

A cross-platform mobile application for land plot listings built with React Native (Expo) and Firebase.

## Features

- Phone number authentication with SMS OTP
- Land plots listing with filters (price, zone, region)
- Land plot details with photos, map location, and cadastral information
- Map view with plot markers and filters
- 1-to-1 chat between land owners and clients
- Investment and credit request functionality
- Dark/loft theme design

## Tech Stack

- React Native with Expo
- TypeScript
- Firebase (Auth, Firestore, Storage)
- React Navigation
- React Native Maps

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- Firebase project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and add your Firebase config:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your Firebase credentials from the Firebase Console.

### Running the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── config/         # App configuration (Firebase, theme)
├── hooks/          # Custom React hooks
├── navigation/     # Navigation setup
├── screens/        # App screens
├── services/       # Firebase services (auth, plots, chat)
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Firebase Setup

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Create a new project or use existing one
3. Go to Project Settings > General > Your apps
4. Add a Web app and copy the config values

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase config:

```bash
cp .env.example .env
```

Edit `.env` with your values:
```
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

Note: Storage bucket can be either `*.appspot.com` (legacy) or `*.firebasestorage.app` (new format). Check your Firebase Console for the correct value.

### 3. Enable Authentication Providers

Go to Firebase Console > Authentication > Sign-in method and enable:

1. **Email/Password** - Enable this provider
2. **Phone** - Enable this provider (requires billing account for SMS)

### 4. Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Deploy Storage Rules

```bash
firebase deploy --only storage
```

### 6. Deploy Cloud Functions (optional)

```bash
cd functions
npm install
firebase deploy --only functions
```

### Troubleshooting

**auth/configuration-not-found**: Email/Password provider not enabled in Firebase Console.

**auth/argument-error with phone auth**: Phone provider not enabled or reCAPTCHA issue. For Expo dev client, ensure you're using the correct Firebase Phone Auth flow.

**storage/unknown**: Check that storageBucket in your `.env` matches the value in Firebase Console > Storage.

**Firestore undefined error**: This has been fixed - the app now properly handles optional fields.

## MVP Scope

This is a strict MVP with the following limitations:
- No admin panel
- No payment processing
- No analytics
- No legal deep checks
- No web version (mobile only)

## Demo Mode

For testing purposes, use OTP code `123456` with any phone number.

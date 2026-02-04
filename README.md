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

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Phone Authentication in Authentication > Sign-in method
3. Create a Firestore database
4. Enable Storage
5. Copy your web app config to the `.env` file

## Admin Panel

The admin panel is a web application for moderating land plots and users.

### Running the Admin Panel

```bash
cd admin
npm install
npm run dev
```

The admin panel will be available at http://localhost:5173

### Admin Configuration

Admin emails are configured in two places:

1. **Admin Panel** (`admin/src/config/adminConfig.ts`):
```typescript
export const ADMIN_EMAILS: string[] = [
  'admin@landplots.com',
  'moderator@landplots.com',
  // Add your admin emails here
];
```

2. **Firestore Security Rules** (`firestore.rules`):
```javascript
function isAdmin() {
  return isAuthenticated() && 
    request.auth.token.email in [
      'admin@landplots.com',
      'moderator@landplots.com'
    ];
}
```

Both lists must match for proper admin access.

### Admin Features

- **Plots Moderation**: View all plots, approve/hide/set pending status
- **Users Moderation**: View all users, block/unblock users
- **Reports**: View and resolve user reports

### Moderation Flow

1. New plots are created with `status: 'pending'`
2. Mobile app only displays plots with `status: 'approved'`
3. Admins can approve plots to make them visible
4. Admins can hide plots to remove them from the mobile app
5. Blocked users cannot create new plots or send messages

## Firestore Security Rules

Deploy the security rules to Firebase:

```bash
firebase deploy --only firestore:rules
```

## MVP Scope

This is a strict MVP with the following limitations:
- No payment processing
- No analytics
- No legal deep checks
- No web version for mobile app (mobile only)

## Demo Mode

For testing purposes, use OTP code `123456` with any phone number.

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

## MVP Scope

This is a strict MVP with the following limitations:
- No admin panel
- No payment processing
- No analytics
- No legal deep checks
- No web version (mobile only)

## Demo Mode

For testing purposes, use OTP code `123456` with any phone number.

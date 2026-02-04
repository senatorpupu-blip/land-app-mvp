# Land Plots Admin Panel

Minimal admin panel for moderating land plots, users, and reports.

## Features

- Firebase Authentication (email login)
- Admin access restricted to hardcoded email list
- Plots moderation: list, approve, hide, set pending
- Users moderation: list, block, unblock
- Reports: list, resolve, hide related plot

## Setup

1. Install dependencies:
```bash
cd admin
npm install
```

2. Configure Firebase:
```bash
cp .env.example .env
```

Edit `.env` with your Firebase credentials:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. Configure admin emails in `src/config/adminConfig.ts`:
```typescript
export const ADMIN_EMAILS: string[] = [
  'admin@landplots.com',
  'moderator@landplots.com',
  // Add your admin emails here
];
```

4. Run development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Deployment

Deploy the `dist` folder to Firebase Hosting or any static hosting service.

### Firebase Hosting

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Initialize Firebase Hosting:
```bash
firebase init hosting
```

3. Deploy:
```bash
firebase deploy --only hosting
```

## Firestore Security Rules

Deploy the Firestore security rules from the project root:
```bash
firebase deploy --only firestore:rules
```

The rules ensure:
- Only approved plots are visible to mobile app users
- Admins can update plot status (approve/hide)
- Admins can block/unblock users
- Blocked users cannot create plots or send messages

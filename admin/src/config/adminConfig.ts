// Hardcoded list of admin emails
// Add admin email addresses here
export const ADMIN_EMAILS: string[] = [
  'admin@landplots.com',
  'moderator@landplots.com',
  // Add more admin emails as needed
];

export const isAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

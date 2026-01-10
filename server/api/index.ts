// Vercel serverless function handler
// This imports the Express app from the main server file

// Since Vercel compiles TypeScript, we can import directly from source
// The main index.ts exports the app and handles serverless vs local development

// Set VERCEL environment variable so the main file knows it's running on Vercel
process.env.VERCEL = '1';

// Import the app - this will set up all routes and middleware
// The app is exported from server/src/index.ts
// Note: Vercel will compile this TypeScript file
import app from '../src/index';

// Export as default for Vercel
// Vercel will automatically handle this as a serverless function
export default app;

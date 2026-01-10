# Quick Start: Deploy Backend to Vercel

## ⚠️ Important Note

The current setup requires you to either:
1. **Copy all API routes** from `server/src/index.ts` to `server/api/index.ts`, OR
2. **Refactor** your code to export route handlers that can be imported

For now, here's the quickest path to deployment:

## Option 1: Quick Deploy (Copy Routes)

1. Copy all your route definitions from `server/src/index.ts` to `server/api/index.ts`
2. Keep the Express app setup in `api/index.ts`
3. Deploy to Vercel

## Option 2: Recommended - Refactor for Serverless

Create a routes file structure:

```
server/
  src/
    routes/
      auth.ts
      users.ts
      products.ts
      orders.ts
      ...
    index.ts (exports app setup)
  api/
    index.ts (imports and uses routes)
```

## Quick Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Navigate to server directory
```bash
cd server
```

### 3. Login to Vercel
```bash
vercel login
```

### 4. Set Environment Variables

Create a `.env` file or set them in Vercel dashboard:

```bash
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add MAIL_FROM
vercel env add SUPER_ADMIN_EMAIL
vercel env add FRONTEND_URL
```

### 5. Deploy
```bash
vercel
```

For production:
```bash
vercel --prod
```

## Current Status

The `api/index.ts` file is set up with:
- ✅ Express app initialization
- ✅ CORS configuration
- ✅ MongoDB connection handling (serverless-friendly)
- ✅ Health check route
- ⚠️ **Missing: All your API routes**

You need to add all routes from `server/src/index.ts` to `server/api/index.ts`.

## Alternative: Use Vercel's API Routes Pattern

Instead of one large file, you could create separate files:

```
server/
  api/
    auth/
      login.ts
      logout.ts
    users/
      index.ts
    products/
      index.ts
```

But this requires significant refactoring.

## Recommended Next Steps

1. **For immediate deployment**: Copy all route handlers to `api/index.ts`
2. **For better architecture**: Refactor to use route modules
3. **For production**: Consider using a dedicated server (Railway, Render, etc.) instead of Vercel for better performance


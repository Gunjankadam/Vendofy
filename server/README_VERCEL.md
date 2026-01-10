# Deploying Backend to Vercel - Complete Guide

## Overview

Your Express backend has been configured to work with Vercel's serverless functions. The setup includes:

- ✅ Express app exported for serverless use
- ✅ MongoDB connection handling for serverless (connection reuse)
- ✅ Vercel configuration file
- ✅ API handler for Vercel

## Quick Deployment Steps

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Navigate to Server Directory

```bash
cd server
```

### 3. Login to Vercel

```bash
vercel login
```

### 4. Set Environment Variables

You can set environment variables via CLI or dashboard:

**Via CLI:**
```bash
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_USER production
vercel env add SMTP_PASS production
vercel env add MAIL_FROM production
vercel env add SUPER_ADMIN_EMAIL production
vercel env add FRONTEND_URL production
```

**Via Dashboard:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create/select your project
3. Settings → Environment Variables
4. Add all required variables

### 5. Deploy

**First deployment (preview):**
```bash
vercel
```

**Production deployment:**
```bash
vercel --prod
```

## How It Works

1. **Vercel detects** the `vercel.json` configuration
2. **Builds** your TypeScript code (`npm run build`)
3. **Routes** all `/api/*` requests to `api/index.ts`
4. **api/index.ts** imports the Express app from `src/index.ts`
5. **Express app** handles all your routes

## Important Notes

### MongoDB Connection

- The server uses connection caching for serverless
- Connections are reused across function invocations
- Make sure MongoDB Atlas allows connections from Vercel IPs

### Environment Variables

Required variables:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Secret for JWT tokens
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP port (usually 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `MAIL_FROM` - Email sender address
- `SUPER_ADMIN_EMAIL` - Super admin email
- `FRONTEND_URL` - Your frontend URL (for CORS)

### CORS Configuration

The server automatically allows requests from `FRONTEND_URL`. Make sure to set this correctly.

### Function Timeouts

- **Hobby plan**: 10 seconds
- **Pro plan**: 60 seconds

If you need longer timeouts, consider:
- Upgrading to Pro plan
- Optimizing slow operations
- Breaking large operations into smaller chunks

## Testing Your Deployment

After deployment, test the health endpoint:

```bash
curl https://your-project.vercel.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "mongo": "connected"
}
```

## Updating Your Deployment

After making changes:

```bash
cd server
vercel --prod
```

Or push to your connected Git repository.

## Troubleshooting

### Build Errors

1. Check that all dependencies are in `package.json`
2. Ensure TypeScript compiles: `npm run build`
3. Check Vercel build logs in dashboard

### MongoDB Connection Issues

1. Verify `MONGODB_URI` is correct
2. Check MongoDB Atlas network access (allow all IPs or add Vercel IPs)
3. Check function logs: `vercel logs`

### Function Timeouts

1. Check Vercel function logs for timeout errors
2. Optimize database queries
3. Consider upgrading to Pro plan

### CORS Errors

1. Verify `FRONTEND_URL` is set correctly
2. Check that your frontend URL matches exactly
3. Review CORS configuration in `src/index.ts`

## Viewing Logs

```bash
vercel logs
```

Or view in Vercel dashboard under "Functions" → "Logs"

## Next Steps

1. ✅ Deploy backend to Vercel
2. Update frontend `.env` with Vercel backend URL:
   ```
   VITE_API_URL=https://your-project.vercel.app
   ```
3. Deploy frontend
4. Test all functionality

## Alternative: Deploy from Root Directory

If you want to deploy both frontend and backend from the root:

1. Move `vercel.json` to root
2. Update paths in `vercel.json`
3. Configure separate projects or use monorepo setup

For now, deploying from `server/` directory is the simplest approach.


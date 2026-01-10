# Deploying Backend to Vercel

This guide will help you deploy your Express backend server to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Vercel CLI installed: `npm i -g vercel`
3. MongoDB Atlas account (or your MongoDB connection string)
4. All environment variables ready

## Step 1: Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

## Step 2: Navigate to Server Directory

```bash
cd server
```

## Step 3: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

## Step 4: Set Up Environment Variables

Before deploying, you need to set all your environment variables in Vercel. You can do this via:

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create a new project or select your project
3. Go to Settings → Environment Variables
4. Add the following variables:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM=your_email@gmail.com
SUPER_ADMIN_EMAIL=admin@example.com
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production
```

### Option B: Via CLI

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
vercel env add NODE_ENV
```

For each variable, select "Production", "Preview", and "Development" environments.

## Step 5: Deploy to Vercel

### First Deployment

```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? Select your account
- Link to existing project? **No** (for first time)
- Project name? Enter a name (e.g., `rolebase-backend`)
- Directory? **./** (current directory)
- Override settings? **No**

### Production Deployment

```bash
vercel --prod
```

## Step 6: Update CORS Settings

After deployment, you'll get a URL like `https://your-project.vercel.app`. 

1. Go to your Vercel project settings
2. Update the `FRONTEND_URL` environment variable to include your frontend domain
3. The backend will automatically allow CORS from the frontend URL

## Step 7: Test Your Deployment

Visit `https://your-project.vercel.app/api/health` to verify the server is running.

## Important Notes

### MongoDB Connection

- The server uses connection pooling for serverless environments
- Connections are reused across function invocations
- Make sure your MongoDB Atlas allows connections from anywhere (or add Vercel IPs)

### Serverless Limitations

- Vercel functions have a 10-second timeout on the Hobby plan, 60 seconds on Pro
- Cold starts may occur if the function hasn't been used recently
- Consider upgrading to Pro plan for better performance

### Environment Variables

- All environment variables must be set in Vercel dashboard
- Changes to environment variables require a new deployment
- Use Vercel's environment variable management for different environments

### CORS Configuration

The server already has CORS enabled. Make sure:
- `FRONTEND_URL` is set correctly in Vercel
- Your frontend uses the Vercel backend URL in `VITE_API_URL`

## Troubleshooting

### Function Timeout

If you experience timeouts:
1. Upgrade to Vercel Pro plan (60s timeout)
2. Optimize your database queries
3. Consider breaking large operations into smaller chunks

### MongoDB Connection Issues

1. Check MongoDB Atlas network access settings
2. Verify `MONGODB_URI` is correct
3. Check Vercel function logs: `vercel logs`

### Build Errors

1. Check that all dependencies are in `package.json`
2. Ensure TypeScript compiles: `npm run build`
3. Check Vercel build logs in the dashboard

## Updating Your Deployment

After making changes:

```bash
cd server
vercel --prod
```

Or push to your connected Git repository (if configured).

## Viewing Logs

```bash
vercel logs
```

Or view in the Vercel dashboard under the "Functions" tab.

## Next Steps

1. Update your frontend `.env` file with the Vercel backend URL:
   ```
   VITE_API_URL=https://your-project.vercel.app
   ```

2. Deploy your frontend (can also be on Vercel or another platform)

3. Test all API endpoints to ensure everything works


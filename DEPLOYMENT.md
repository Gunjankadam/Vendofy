# Deployment Guide

## Environment Variables Setup

### Frontend (.env)
Create a `.env` file in the root directory with:
```env
VITE_API_URL=http://localhost:5000
```

For production, update to:
```env
VITE_API_URL=https://api.yourdomain.com
```

### Backend (server/.env)
Create a `.env` file in the `server` directory with:
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/rolebase-dashboard
JWT_SECRET=your-super-secret-jwt-key-change-this
SUPER_ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=your-email@gmail.com
FRONTEND_URL=http://localhost:8080
```

## Building for Production

### Frontend
```bash
npm run build
```
The built files will be in the `dist` directory.

### Backend
```bash
cd server
npm run build
```
The built files will be in the `server/dist` directory.

## Running in Production

### Backend
```bash
cd server
npm start
```

### Frontend
Serve the `dist` directory using a web server like Nginx or Apache, or use:
```bash
npm run preview
```

## Important Notes

1. **API URL Configuration**: The frontend uses `VITE_API_URL` environment variable. Make sure to set this correctly for your production environment.

2. **CORS**: The backend CORS is configured to allow requests from `FRONTEND_URL`. Update this in production.

3. **Security**: 
   - Change `JWT_SECRET` to a strong random string
   - Use HTTPS in production
   - Keep environment variables secure

4. **Database**: Use a production MongoDB instance (MongoDB Atlas recommended for cloud deployments).


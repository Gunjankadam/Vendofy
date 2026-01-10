# Rolebase Dashboard

A comprehensive role-based dashboard application built with React, TypeScript, Express, and MongoDB. This system supports three user roles: Administrators, Distributors, and Customers, each with their own specialized interface and functionality.

## 🚀 Features

### For Administrators
- User management (create, edit, delete users)
- Product management and approval system
- Order notifications and tracking
- Revenue and order statistics
- System settings configuration
- Product usage management for distribution chains
- Hierarchical user structure management

### For Distributors
- Order management and tracking
- Transit box for managing in-transit orders
- Customer pricing management
- Order delivery date updates
- Mark orders as received
- View assigned customers and products

### For Customers
- Browse available products
- Place orders with custom delivery dates
- Order history and tracking
- Payment tracking and updates
- Mark orders as received
- View order status and delivery information

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **React Query** for data fetching
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **TypeScript**
- **MongoDB** with Mongoose
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Nodemailer** for email functionality
- **express-rate-limit** for API security
- **Helmet** for security headers

## 📋 Prerequisites

- Node.js (v20 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn
- SMTP server credentials (for email functionality)

## 🔧 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd rolebase-dashboard-main
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

## ⚙️ Environment Setup

### Frontend Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:5000
```

For production:
```env
VITE_API_URL=https://api.yourdomain.com
```

### Backend Environment Variables

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/rolebase-dashboard
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/database

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Super Admin Configuration
SUPER_ADMIN_EMAIL=admin@example.com

# SMTP Configuration (for email sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=your-email@gmail.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:8080
# For production: FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com
```

## 🏃 Running the Application

### Development Mode

#### Start Backend Server

```bash
cd server
npm run dev
```

The backend will run on `http://localhost:5000`

#### Start Frontend Development Server

```bash
npm run dev
```

The frontend will run on `http://localhost:8080`

### Production Build

#### Build Backend

```bash
cd server
npm run build
npm start
```

#### Build Frontend

```bash
npm run build
```

The built files will be in the `dist` directory. Serve them using a web server like Nginx or Apache.

## 📁 Project Structure

```
rolebase-dashboard-main/
├── src/                    # Frontend source code
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── Header.tsx    # Main header component
│   ├── contexts/         # React contexts (Auth)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   │   └── api.ts        # API configuration
│   └── pages/            # Page components
│       ├── Dashboard.tsx
│       ├── Login.tsx
│       ├── UserManagement.tsx
│       ├── ProductManagement.tsx
│       └── ...
├── server/                # Backend source code
│   ├── src/
│   │   ├── models/       # MongoDB models
│   │   │   ├── User.ts
│   │   │   ├── Product.ts
│   │   │   ├── Order.ts
│   │   │   └── ...
│   │   └── index.ts      # Main server file
│   └── package.json
├── public/                # Static assets
├── .env                  # Frontend environment variables
├── .env.example          # Frontend environment template
├── package.json          # Frontend dependencies
└── README.md             # This file
```

## 🔐 Security Features

- **JWT Authentication** with token blacklisting
- **Rate Limiting** on authentication endpoints
- **Password Hashing** using bcryptjs
- **CORS** configuration for cross-origin requests
- **Security Headers** via Helmet
- **Input Validation** and sanitization
- **Email Verification** for new users
- **Password Reset** with OTP codes

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify-email` - Verify email address
- `POST /api/auth/forgot-password/request` - Request password reset
- `POST /api/auth/forgot-password/reset` - Reset password

### Users (Admin Only)
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/users/stats` - Get user statistics

### Products
- `GET /api/products` - Get all products (Admin/Distributor)
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product (Super Admin)
- `GET /api/customer/products` - Get products for customers

### Orders
- `GET /api/customer/orders` - Get customer orders
- `POST /api/customer/orders` - Create order
- `GET /api/distributor/orders` - Get distributor orders
- `POST /api/distributor/orders/mark-for-today` - Mark orders for today
- `POST /api/distributor/orders/:id/mark-received` - Mark order as received

### System Settings
- `GET /api/system-settings` - Get system settings
- `PUT /api/system-settings` - Update system settings (Super Admin)
- `POST /api/system-settings/pending` - Request settings change (Admin)

## 👥 User Roles

### Super Admin
- Full system access
- Can approve/reject product submissions
- Can approve/reject system settings changes
- All admin capabilities

### Admin
- User management
- Product management
- Order notifications
- Revenue tracking
- Can request system settings changes

### Distributor
- Manage assigned customers
- Set custom pricing for customers
- Manage orders and deliveries
- Transit box management

### Customer
- Browse and purchase products
- Track orders
- Update payment information
- View order history

## 🚢 Deployment

### Environment Variables

Ensure all environment variables are set correctly for production:

1. **Backend**: Update `server/.env` with production values
2. **Frontend**: Update root `.env` with production API URL

### Build Commands

```bash
# Backend
cd server
npm run build
npm start

# Frontend
npm run build
# Serve the dist/ directory
```

### Recommended Deployment Platforms

- **Frontend**: Vercel, Netlify, or any static hosting
- **Backend**: Railway, Render, Heroku, or VPS
- **Database**: MongoDB Atlas (recommended)

## 🧪 Development

### Code Structure

- **Frontend**: Component-based architecture with TypeScript
- **Backend**: RESTful API with Express and MongoDB
- **State Management**: React Context API
- **Styling**: Tailwind CSS with shadcn/ui components

### Adding New Features

1. Create models in `server/src/models/` if needed
2. Add API routes in `server/src/index.ts`
3. Create frontend components in `src/pages/` or `src/components/`
4. Update routing in `src/App.tsx` if needed

## 📝 Notes

- Email verification is required for new users (except super admin)
- Passwords must be at least 6 characters
- JWT tokens expire based on system settings (default: 1 hour)
- Rate limiting is applied to authentication endpoints
- All API endpoints require authentication except login, email verification, and password reset

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary. All rights reserved.

## 🆘 Support

For issues and questions, please contact the development team or create an issue in the repository.

## 🔄 Version

Current Version: 1.0.0

---

**Built with ❤️ using React, TypeScript, and Node.js**

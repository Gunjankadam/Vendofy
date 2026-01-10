import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import { User } from "./models/User";
import { RevokedToken } from "./models/RevokedToken";
import { PasswordResetToken } from "./models/PasswordResetToken";
import { EmailVerificationToken } from "./models/EmailVerificationToken";
import { SystemSettings } from "./models/SystemSettings";
import { Product } from "./models/Product";
import { Order } from "./models/Order";
import { PendingSettingsChange } from "./models/PendingSettingsChange";
import { CustomerPricing } from "./models/CustomerPricing";
import { AdminProductPricing } from "./models/AdminProductPricing";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in environment variables.");
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set in environment variables.");
  process.exit(1);
}

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
  console.error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM must be set in environment variables.");
  process.exit(1);
}

const mailTransporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Rate limiting configurations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: "Too many login attempts from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: "Too many password reset attempts from this IP, please try again after 1 hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 email verification attempts per hour
  message: "Too many email verification attempts from this IP, please try again after 1 hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all API routes
app.use("/api/", generalApiLimiter);

// Simple health check route (no rate limit needed)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mongo: mongoose.connection.readyState });
});

// Get user statistics (counts by role)
app.get("/api/admin/users/stats", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean; role?: string };
    const currentUser = await User.findById(auth.id);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found." });
    }

    const filter: any = {};

    let adminCount = 0;
    let distributorCount = 0;
    let customerCount = 0;

    // Role-based filtering: users can only see their associated users
    if (currentUser.role === "distributor") {
      // Distributors can only see customers they created
      customerCount = await User.countDocuments({
        parentId: currentUser._id,
        role: "customer",
        isActive: true,
      });
    } else if (currentUser.role === "admin" && !auth.isSuperAdmin) {
      // Regular admins can see distributors they created and customers under those distributors
      // Get distributors created by this admin
      distributorCount = await User.countDocuments({
        parentId: currentUser._id,
        role: "distributor",
        isActive: true,
      });

      // Get customers under those distributors
      const distributorIds = await User.find({ parentId: currentUser._id, role: "distributor" })
        .select("_id")
        .lean()
        .exec();
      const distributorObjectIds = distributorIds.map((d) => d._id);
      
      if (distributorObjectIds.length > 0) {
        customerCount = await User.countDocuments({
          parentId: { $in: distributorObjectIds },
          role: "customer",
          isActive: true,
        });
      }

      // Also count customers directly created by this admin
      const directCustomerCount = await User.countDocuments({
        parentId: currentUser._id,
        role: "customer",
        isActive: true,
      });
      customerCount += directCustomerCount;
    } else if (auth.isSuperAdmin) {
      // Super admin can see everyone
      adminCount = await User.countDocuments({
        role: "admin",
        isActive: true,
      });
      distributorCount = await User.countDocuments({
        role: "distributor",
        isActive: true,
      });
      customerCount = await User.countDocuments({
        role: "customer",
        isActive: true,
      });
    }

    const total = adminCount + distributorCount + customerCount;

    return res.status(200).json({
      total,
      admin: adminCount,
      distributor: distributorCount,
      customer: customerCount,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get revenue and orders statistics with hierarchical breakdown
app.get("/api/admin/stats/revenue-orders", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { level, parentId, dateFilter, startDate, endDate, month, year } = req.query as { 
      level?: string; 
      parentId?: string;
      dateFilter?: string; // 'all' | 'today' | 'thisMonth' | 'thisYear' | 'custom' | 'month' | 'year'
      startDate?: string;
      endDate?: string;
      month?: string; // 1-12
      year?: string;
    };
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean; role?: string };
    const currentUser = await User.findById(auth.id);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found." });
    }

    let filter: any = {};
    
    // Apply date filters
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      let dateStart: Date;
      let dateEnd: Date = new Date(now);
      dateEnd.setHours(23, 59, 59, 999);
      
      if (dateFilter === 'today') {
        dateStart = new Date(now);
        dateStart.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'thisMonth') {
        dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateFilter === 'thisYear') {
        dateStart = new Date(now.getFullYear(), 0, 1);
      } else if (dateFilter === 'month' && month && year) {
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        dateStart = new Date(yearNum, monthNum - 1, 1);
        dateEnd = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      } else if (dateFilter === 'year' && year) {
        const yearNum = parseInt(year);
        dateStart = new Date(yearNum, 0, 1);
        dateEnd = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      } else if (dateFilter === 'custom' && startDate && endDate) {
        dateStart = new Date(startDate);
        dateStart.setHours(0, 0, 0, 0);
        dateEnd = new Date(endDate);
        dateEnd.setHours(23, 59, 59, 999);
      } else {
        // Default to all time if invalid filter
        dateStart = new Date(0);
      }
      
      filter.createdAt = {
        $gte: dateStart,
        $lte: dateEnd,
      };
    }

    // Role-based filtering
    if (currentUser.role === "distributor") {
      filter.distributorId = currentUser._id;
    } else if (currentUser.role === "admin" && !auth.isSuperAdmin) {
      const distributorIds = await User.find({ parentId: currentUser._id, role: "distributor" })
        .select("_id")
        .lean()
        .exec();
      const distributorObjectIds = distributorIds.map((d) => d._id);
      filter.$or = [
        { adminId: currentUser._id },
        { distributorId: { $in: distributorObjectIds } },
      ];
    }
    // Super admin can see everyone

    // Get total revenue and orders (only count amountPaid, not totalAmount)
    const totalRevenueResult = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$amountPaid", null] }, { $gt: ["$amountPaid", 0] }] },
                "$amountPaid",
                0
              ]
            }
          }
        }
      },
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    const totalOrders = await Order.countDocuments(filter);

    // If level is specified, get breakdown
    let breakdown: any[] = [];
    if (level === "admin") {
      // For super admin: show breakdown by all admins
      // For regular admin: show breakdown by their distributors
      if (auth.isSuperAdmin) {
        // Get revenue and orders per admin
        const adminBreakdown = await Order.aggregate([
          { $match: { ...filter, adminId: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: "$adminId",
              revenue: {
                $sum: {
                  $cond: [
                    { $and: [{ $ne: ["$amountPaid", null] }, { $gt: ["$amountPaid", 0] }] },
                    "$amountPaid",
                    0
                  ]
                }
              },
              orders: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "admin",
            },
          },
          { $unwind: "$admin" },
          { $project: { adminId: "$_id", name: "$admin.name", email: "$admin.email", revenue: 1, orders: 1 } },
        ]);
        breakdown = adminBreakdown;
      } else if (currentUser.role === "admin") {
        // For regular admin: show their distributors directly
        const distributorIds = await User.find({ parentId: currentUser._id, role: "distributor" })
          .select("_id")
          .lean()
          .exec();
        const distributorObjectIds = distributorIds.map((d) => d._id);
        if (distributorObjectIds.length > 0) {
          const distributorBreakdown = await Order.aggregate([
            { $match: { ...filter, distributorId: { $in: distributorObjectIds } } },
            {
              $group: {
                _id: "$distributorId",
                revenue: {
                  $sum: {
                    $cond: [
                      { $and: [{ $ne: ["$amountPaid", null] }, { $gt: ["$amountPaid", 0] }] },
                      "$amountPaid",
                      0
                    ]
                  }
                },
                orders: { $sum: 1 },
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "distributor",
              },
            },
            { $unwind: "$distributor" },
            { $project: { distributorId: "$_id", name: "$distributor.name", email: "$distributor.email", revenue: 1, orders: 1 } },
          ]);
          breakdown = distributorBreakdown;
        }
      }
    } else if (level === "distributor" && parentId) {
      // Get revenue and orders per distributor under a specific admin
      const distributorBreakdown = await Order.aggregate([
        { $match: { ...filter, adminId: new mongoose.Types.ObjectId(parentId), distributorId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$distributorId",
            revenue: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ["$amountPaid", null] }, { $gt: ["$amountPaid", 0] }] },
                  "$amountPaid",
                  0
                ]
              }
            },
            orders: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "distributor",
          },
        },
        { $unwind: "$distributor" },
        { $project: { distributorId: "$_id", name: "$distributor.name", email: "$distributor.email", revenue: 1, orders: 1 } },
      ]);
      breakdown = distributorBreakdown;
    } else if (level === "customer" && parentId) {
      // Get revenue and orders per customer under a specific distributor
      const customerBreakdown = await Order.aggregate([
        { $match: { ...filter, distributorId: new mongoose.Types.ObjectId(parentId) } },
        {
          $group: {
            _id: "$customerId",
            revenue: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ["$amountPaid", null] }, { $gt: ["$amountPaid", 0] }] },
                  "$amountPaid",
                  0
                ]
              }
            },
            orders: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        { $project: { customerId: "$_id", name: "$customer.name", email: "$customer.email", revenue: 1, orders: 1 } },
      ]);
      breakdown = customerBreakdown;
    }

    return res.status(200).json({
      totalRevenue,
      totalOrders,
      breakdown,
    });
  } catch (error) {
    console.error("Get revenue/orders stats error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: list users with basic filtering
app.get("/api/admin/users", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { search, role, status } = req.query as {
      search?: string;
      role?: string;
      status?: string;
    };

    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean; role?: string };
    const currentUser = await User.findById(auth.id);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found." });
    }

    const filter: any = {};

    // Role-based filtering: users can only see their associated users
    if (currentUser.role === "distributor") {
      // Distributors can only see customers they created
      filter.parentId = currentUser._id;
      filter.role = "customer";
    } else if (currentUser.role === "admin" && !auth.isSuperAdmin) {
      // Regular admins can see distributors they created and customers under those distributors
      const distributorIds = await User.find({ parentId: currentUser._id, role: "distributor" })
        .select("_id")
        .lean()
        .exec();
      const distributorObjectIds = distributorIds.map((d) => d._id);
      filter.$or = [
        { parentId: currentUser._id, role: "distributor" }, // Distributors created by this admin
        { parentId: { $in: distributorObjectIds }, role: "customer" }, // Customers under those distributors
      ];
    }
    // Super admin can see everyone (no additional filter)

    // Build search filter
    if (search) {
      const regex = new RegExp(search, "i");
      const searchFilter = { $or: [{ name: regex }, { email: regex }] };
      if (filter.$or) {
        // Combine existing $or with search using $and
        filter.$and = [{ $or: filter.$or }, searchFilter];
        delete filter.$or;
      } else {
        filter.$and = filter.$and || [];
        filter.$and.push(searchFilter);
      }
    }

    // Apply role filter
    if (role && ["admin", "distributor", "customer"].includes(role)) {
      if (filter.$and) {
        filter.$and.push({ role });
      } else if (filter.$or) {
        // If we have $or, we need to add role to each condition or use $and
        filter.$and = [{ $or: filter.$or }, { role }];
        delete filter.$or;
      } else {
        filter.role = role;
      }
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    const users = await User.find(filter)
      .select("name email role isActive lastLoginAt createdAt uid mobileNo businessName address registrationNo registrationCopyUrl createdBy parentId")
      .populate("createdBy", "name email role")
      .populate("parentId", "name email role")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.status(200).json(users);
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: suggest UID
app.get("/api/admin/users/suggest-uid", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { role, businessName, name } = req.query as {
      role?: string;
      businessName?: string;
      name?: string;
    };

    if (!role || !["admin", "distributor", "customer"].includes(role)) {
      return res.status(400).json({ message: "Valid role is required." });
    }

    let suggestedUID = generateUID(role, businessName, name);
    let attempts = 0;
    // Ensure UID is unique
    while (attempts < 10) {
      const existing = await User.findOne({ uid: suggestedUID });
      if (!existing) break;
      suggestedUID = generateUID(role, businessName, name);
      attempts++;
    }

    return res.status(200).json({ uid: suggestedUID });
  } catch (error) {
    console.error("Suggest UID error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: check if UID exists
app.get("/api/admin/users/check-uid/:uid", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { uid } = req.params;
    const existing = await User.findOne({ uid });
    return res.status(200).json({ exists: !!existing });
  } catch (error) {
    console.error("Check UID error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: create new user
app.post("/api/admin/users", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      isActive,
      uid,
      mobileNo,
      businessName,
      address,
      registrationNo,
      registrationCopyUrl,
    } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "admin" | "distributor" | "customer";
      isActive?: boolean;
      uid?: string;
      mobileNo?: string;
      businessName?: string;
      address?: {
        address1?: string;
        address2?: string;
        city?: string;
        district?: string;
        pin?: string;
        state?: string;
        country?: string;
      };
      registrationNo?: string;
      registrationCopyUrl?: string;
    };

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required." });
    }

    if (!["admin", "distributor", "customer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    // Get field requirements from system settings
    const settings = await SystemSettings.findOne();
    const fieldReqs = settings?.fieldRequirements?.[role as "admin" | "distributor" | "customer"];

    // Validate required fields based on role requirements
    if (fieldReqs?.mobileNo && !mobileNo) {
      return res.status(400).json({ message: "Mobile number is required for this role." });
    }
    if (fieldReqs?.businessName && !businessName) {
      return res.status(400).json({ message: "Business name is required for this role." });
    }
    if (fieldReqs?.address && (!address?.address1 || !address?.city || !address?.state || !address?.country)) {
      return res.status(400).json({ message: "Complete address is required for this role." });
    }
    // Registration: either registrationNo OR registrationCopyUrl is required if field requirement is set
    if (fieldReqs?.registrationNo || fieldReqs?.registrationCopy) {
      if (!registrationNo && !registrationCopyUrl) {
        return res.status(400).json({ message: "Either registration number or registration copy is required for this role." });
      }
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists." });
    }

    // Check if UID already exists (if provided)
    let finalUID = uid;
    if (uid) {
      const existingUID = await User.findOne({ uid });
      if (existingUID) {
        return res.status(400).json({ message: "UID already exists." });
      }
    } else {
      // Generate UID if not provided
      let suggestedUID = generateUID(role, businessName, name);
      let attempts = 0;
      while (attempts < 10) {
        const existing = await User.findOne({ uid: suggestedUID });
        if (!existing) break;
        suggestedUID = generateUID(role, businessName, name);
        attempts++;
      }
      finalUID = suggestedUID;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Get the current user (creator)
    const auth = (req as any).user as { id: string; role?: string };
    const creator = await User.findById(auth.id);
    if (!creator) {
      return res.status(401).json({ message: "Creator not found." });
    }

    // Set associations based on role hierarchy
    let parentId: mongoose.Types.ObjectId | undefined;
    if (role === "distributor") {
      // Distributor is created by admin, so parentId = admin
      if (creator.role !== "admin" && creator.role !== "super-admin") {
        return res.status(403).json({ message: "Only admins can create distributors." });
      }
      parentId = creator._id;
    } else if (role === "customer") {
      // Customer is created by distributor or admin, so parentId = creator
      if (creator.role === "distributor" || creator.role === "admin" || creator.role === "super-admin") {
        parentId = creator._id;
      } else {
        return res.status(403).json({ message: "Only admins or distributors can create customers." });
      }
    }
    // Admin has no parent (only super-admin can create admin)

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      isActive: isActive !== undefined ? isActive : true,
      uid: finalUID,
      mobileNo,
      businessName,
      address: address || undefined,
      registrationNo,
      registrationCopyUrl,
      createdBy: creator._id,
      parentId: parentId,
      emailVerified: false, // Email not verified yet
    });

    // Generate verification token and send email
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await EmailVerificationToken.create({
      email: email.toLowerCase(),
      token: verificationToken,
      expiresAt,
      used: false,
    });

    // Build verification URL (assuming frontend is on localhost:5173, adjust as needed)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    // Send verification email
    try {
      await mailTransporter.sendMail({
        from: MAIL_FROM,
        to: email.toLowerCase(),
        subject: "Verify Your Email Address - Vendofy",
        html: buildVerificationEmailHtml(name, verificationUrl),
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail user creation if email fails, but log it
    }

    // Populate associations for response
    const populatedUser = await User.findById(newUser._id)
      .populate("createdBy", "name email role")
      .populate("parentId", "name email role")
      .lean()
      .exec();

    return res.status(201).json({
      _id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      uid: newUser.uid,
      mobileNo: newUser.mobileNo,
      businessName: newUser.businessName,
      address: newUser.address,
      registrationNo: newUser.registrationNo,
      registrationCopyUrl: newUser.registrationCopyUrl,
      createdBy: populatedUser?.createdBy,
      parentId: populatedUser?.parentId,
      createdAt: (newUser as any).createdAt,
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    if (error.code === 11000) {
      if (error.keyPattern?.email) {
        return res.status(400).json({ message: "Email already exists." });
      }
      if (error.keyPattern?.uid) {
        return res.status(400).json({ message: "UID already exists." });
      }
      return res.status(400).json({ message: "Duplicate field value." });
    }
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: update user details
app.put("/api/admin/users/:id", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      role,
      isActive,
      uid,
      mobileNo,
      businessName,
      address,
      registrationNo,
      registrationCopyUrl,
    } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "admin" | "distributor" | "customer";
      isActive?: boolean;
      uid?: string;
      mobileNo?: string;
      businessName?: string;
      address?: {
        address1?: string;
        address2?: string;
        city?: string;
        district?: string;
        pin?: string;
        state?: string;
        country?: string;
      };
      registrationNo?: string;
      registrationCopyUrl?: string;
    };

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent editing super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      return res.status(403).json({ message: "Cannot edit super admin." });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) {
      // Check if new email already exists (excluding current user)
      const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists." });
      }
      user.email = email.toLowerCase();
    }
    if (password !== undefined && password.trim() !== "") {
      user.password = await bcrypt.hash(password, 10);
    }
    if (role !== undefined) {
      if (!["admin", "distributor", "customer"].includes(role)) {
        return res.status(400).json({ message: "Invalid role." });
      }
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = isActive;
    if (uid !== undefined) {
      // Check if UID already exists (excluding current user)
      const existingUID = await User.findOne({ uid, _id: { $ne: id } });
      if (existingUID) {
        return res.status(400).json({ message: "UID already exists." });
      }
      user.uid = uid;
    }
    if (mobileNo !== undefined) user.mobileNo = mobileNo;
    if (businessName !== undefined) user.businessName = businessName;
    if (address !== undefined) user.address = address;
    if (registrationNo !== undefined) user.registrationNo = registrationNo;
    if (registrationCopyUrl !== undefined) user.registrationCopyUrl = registrationCopyUrl;

    await user.save();

    return res.status(200).json({
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      uid: user.uid,
      mobileNo: user.mobileNo,
      businessName: user.businessName,
      address: user.address,
      registrationNo: user.registrationNo,
      registrationCopyUrl: user.registrationCopyUrl,
      lastLoginAt: user.lastLoginAt,
      createdAt: (user as any).createdAt,
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    if (error.code === 11000) {
      if (error.keyPattern?.email) {
        return res.status(400).json({ message: "Email already exists." });
      }
      if (error.keyPattern?.uid) {
        return res.status(400).json({ message: "UID already exists." });
      }
      return res.status(400).json({ message: "Duplicate field value." });
    }
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: delete user
app.delete("/api/admin/users/:id", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent deleting super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      return res.status(403).json({ message: "Cannot delete super admin." });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: update user role
app.put("/api/admin/users/:id/role", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: "admin" | "distributor" | "customer" };

    if (!role || !["admin", "distributor", "customer"].includes(role)) {
      return res.status(400).json({ message: "Valid role is required." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent editing super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      return res.status(403).json({ message: "Cannot change super admin role." });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update role error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: update user status (active/inactive)
app.put("/api/admin/users/:id/status", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive?: boolean };

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent editing super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      return res.status(403).json({ message: "Cannot change super admin status." });
    }

    user.isActive = isActive;
    await user.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Admin: force password reset
app.post("/api/admin/users/:id/force-reset", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent editing super admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      return res.status(403).json({ message: "Cannot force reset super admin password." });
    }

    user.mustChangePassword = true;
    await user.save();

    // Send email notification
    try {
      await mailTransporter.sendMail({
        from: MAIL_FROM,
        to: user.email,
        subject: "Password Reset Required - Vendofy",
        html: buildForceResetEmailHtml(user.name),
      });
    } catch (emailError) {
      console.error("Failed to send force reset email:", emailError);
      // Continue even if email fails
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Force reset error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Middleware to authenticate and check blacklist
async function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid authorization header." });
    }

    const token = authHeader.substring("Bearer ".length);

    // Check blacklist
    const revoked = await RevokedToken.findOne({ token }).lean().exec();
    if (revoked) {
      return res.status(401).json({ message: "Token has been revoked." });
    }

    const payload = jwt.verify(token, JWT_SECRET as string) as JwtPayload & {
      sub: string;
      role: string;
      isSuperAdmin?: boolean;
    };

    (req as any).user = {
      id: payload.sub,
      role: payload.role,
      isSuperAdmin: payload.isSuperAdmin,
      token,
    };

    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

// Input validation helper
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  // At least 6 characters
  return !!password && password.length >= 6;
}

// Login route with rate limiting
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email, password, role } = req.body as {
      email?: string;
      password?: string;
      role?: string;
    };

    // Input validation
    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password and role are required." });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Validate password
    if (!isValidPassword(password)) {
      return res.status(400).json({ message: "Invalid password format." });
    }

    // Validate role
    if (!["admin", "distributor", "customer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    // Sanitize email (trim and lowercase)
    const sanitizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is inactive. Please contact an administrator." });
    }

    // Super admin special handling
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

    // Super admin is identified only by special email; DB role value doesn't matter here
    const isSuperAdminRecord =
      !!superAdminEmail && user.email === superAdminEmail;

    // If this is the super admin user but a non-admin role is selected, block login.
    if (isSuperAdminRecord && role !== "admin") {
      return res
        .status(401)
        .json({ message: "Super admin must log in with the Administrator role." });
    }

    const isSuperAdminUser = isSuperAdminRecord && role === "admin";

    // Check if email is verified (skip for super admin)
    if (!isSuperAdminUser && !user.emailVerified) {
      return res.status(403).json({ 
        message: "Please verify your email address before logging in. Check your inbox for the verification link." 
      });
    }

    // Determine requested application role based on selected role
    let appRole: "admin" | "distributor" | "customer";
    if (role === "admin") {
      appRole = "admin";
    } else if (role === "distributor") {
      appRole = "distributor";
    } else {
      appRole = "customer";
    }

    // Enforce role-based login for non-super-admins
    if (!isSuperAdminUser) {
      // Allow normal admins to log in only as admin
      if (appRole === "admin" && user.role !== "admin") {
        return res.status(403).json({ message: "You are not allowed to log in as Administrator." });
      }

      // For distributor and customer, the DB role must match exactly
      if ((appRole === "distributor" || appRole === "customer") && user.role !== appRole) {
        return res.status(403).json({ message: "You are not allowed to log in with this role." });
      }
    }

    // Get JWT session duration from settings (default: 1 hour in seconds)
    const systemSettings = await SystemSettings.findOne();
    const rawDuration = systemSettings?.jwtSessionDuration || 3600;
    // Backwards compatibility: if duration is very small, treat it as hours instead of seconds
    const jwtDurationSeconds = rawDuration < 60 ? rawDuration * 3600 : rawDuration;
    const jwtDurationString = jwtDurationSeconds < 60 
      ? `${jwtDurationSeconds}s` 
      : jwtDurationSeconds < 3600 
        ? `${Math.floor(jwtDurationSeconds / 60)}m` 
        : `${Math.floor(jwtDurationSeconds / 3600)}h`;

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        role: appRole,
        isSuperAdmin: isSuperAdminUser,
      },
      JWT_SECRET as string,
      { expiresIn: jwtDurationString } as jwt.SignOptions
    );

    const expiresAt = Date.now() + jwtDurationSeconds * 1000;

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: appRole,
      isSuperAdmin: isSuperAdminUser,
      avatarUrl: user.avatarUrl,
      token,
      expiresAt,
      mustChangePassword: user.mustChangePassword || false,
      uid: user.uid || undefined,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Logout route - blacklist current token
app.post("/api/auth/logout", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { token: string };
    const token = auth?.token;

    if (!token) {
      return res.status(200).json({ success: true });
    }

    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded || !decoded.exp) {
      return res.status(200).json({ success: true });
    }

    const expiresAt = new Date(decoded.exp * 1000);

    await RevokedToken.updateOne(
      { token },
      { token, expiresAt },
      { upsert: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateVerificationToken() {
  return require("crypto").randomBytes(32).toString("hex");
}

function generateTemporaryPassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Generate UID based on role, business name, and name
function generateUID(role: string, businessName?: string, name?: string): string {
  const rolePrefix = role.toUpperCase().substring(0, 3); // ADM, DIS, CUS
  const businessPart = businessName
    ? businessName
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .substring(0, 6)
    : "";
  const namePart = name
    ? name
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .substring(0, 4)
    : "";
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `${rolePrefix}${businessPart}${namePart}${randomPart}`.substring(0, 20);
}

function buildVerificationEmailHtml(name: string, verificationUrl: string) {
  return `
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <title>Verify Your Email</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#020617;border-radius:16px;border:1px solid #1e293b;padding:32px;color:#e5e7eb;">
              <tr>
                <td align="left" style="padding-bottom:24px;border-bottom:1px solid #1e293b;">
                  <span style="font-size:22px;font-weight:600;font-family:serif;letter-spacing:-0.03em;color:#e5e7eb;">Vendofy</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;padding-bottom:16px;">
                  <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;font-family:serif;color:#f9fafb;">
                    Verify your email address
                  </h1>
                  <p style="margin:0;font-size:14px;line-height:1.5;color:#9ca3af;">
                    Hi ${name},<br /><br />
                    Welcome! Please verify your email address to activate your account. Click the button below to verify your email.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:24px 0;">
                  <a href="${verificationUrl}" style="display:inline-block;padding:12px 32px;border-radius:8px;background-color:#3b82f6;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                    Verify Email Address
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:16px;">
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;">
                    If the button doesn't work, copy and paste this link into your browser:<br />
                    <span style="color:#60a5fa;word-break:break-all;">${verificationUrl}</span>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                    This link will expire in <strong style="color:#e5e7eb;">24 hours</strong>.<br /><br />
                    Thanks,<br />
                    <span style="color:#e5e7eb;">The Vendofy Team</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function buildPasswordEmailHtml(name: string, password: string) {
  return `
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <title>Your Account Password</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#020617;border-radius:16px;border:1px solid #1e293b;padding:32px;color:#e5e7eb;">
              <tr>
                <td align="left" style="padding-bottom:24px;border-bottom:1px solid #1e293b;">
                  <span style="font-size:22px;font-weight:600;font-family:serif;letter-spacing:-0.03em;color:#e5e7eb;">Vendofy</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;padding-bottom:16px;">
                  <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;font-family:serif;color:#f9fafb;">
                    Your account is ready!
                  </h1>
                  <p style="margin:0;font-size:14px;line-height:1.5;color:#9ca3af;">
                    Hi ${name},<br /><br />
                    Your email has been verified. Your account is now active. Use the temporary password below to log in.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:24px 0;">
                  <div style="display:inline-block;padding:14px 24px;border-radius:8px;background-color:#1e293b;border:1px solid #334155;">
                    <span style="font-size:18px;font-weight:600;color:#60a5fa;font-family:monospace;">
                      ${password}
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:16px;">
                  <div style="padding:16px;border-radius:8px;background-color:#1e1e2e;border-left:4px solid #f59e0b;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#fbbf24;font-weight:600;">
                      ⚠️ Important: Change your password immediately
                    </p>
                    <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">
                      For security, please change this temporary password as soon as you log in. Use the "Forgot Password" option if needed.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                    Thanks,<br />
                    <span style="color:#e5e7eb;">The Vendofy Team</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function buildForceResetEmailHtml(name: string) {
  return `
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <title>Password Reset Required</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#020617;border-radius:16px;border:1px solid #1e293b;padding:32px;color:#e5e7eb;">
              <tr>
                <td align="left" style="padding-bottom:24px;border-bottom:1px solid #1e293b;">
                  <span style="font-size:22px;font-weight:600;font-family:serif;letter-spacing:-0.03em;color:#e5e7eb;">Vendofy</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;padding-bottom:16px;">
                  <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;font-family:serif;color:#f9fafb;">
                    Password Reset Required
                  </h1>
                  <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">
                    Hello ${name || 'User'},
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;line-height:1.6;">
                    Your account password has been reset by an administrator. For security reasons, you must change your password before you can continue using your account.
                  </p>
                  <p style="margin:0 0 16px 0;font-size:14px;color:#cbd5e1;line-height:1.6;">
                    Please log in to your account and use the "Forgot Password" feature to set a new password. You will be prompted to change your password every time you log in until you complete this step.
                  </p>
                  <div style="background-color:#1e293b;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #f59e0b;">
                    <p style="margin:0;font-size:13px;color:#fbbf24;font-weight:500;">
                      ⚠️ Important: You must change your password on your next login. This is mandatory for security purposes.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;border-top:1px solid #1e293b;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#64748b;">
                    If you did not request this password reset, please contact your administrator immediately.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function buildOtpEmailHtml(code: string) {
  return `
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <title>Password Reset</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#020617;border-radius:16px;border:1px solid #1e293b;padding:32px;color:#e5e7eb;">
              <tr>
                <td align="left" style="padding-bottom:24px;border-bottom:1px solid #1e293b;">
                  <span style="font-size:22px;font-weight:600;font-family:serif;letter-spacing:-0.03em;color:#e5e7eb;">Vendofy</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;padding-bottom:16px;">
                  <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:600;font-family:serif;color:#f9fafb;">
                    Reset your password
                  </h1>
                  <p style="margin:0;font-size:14px;line-height:1.5;color:#9ca3af;">
                    Use the one-time code below to finish resetting your password. This code is valid for the next
                    <strong style="color:#e5e7eb;">10 minutes</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:24px 0;">
                  <div style="display:inline-block;padding:14px 24px;border-radius:9999px;background-color:#dcfce7;border:1px solid #bbf7d0;">
                    <span style="font-size:24px;letter-spacing:0.35em;font-weight:600;color:#15803d;">
                      ${code}
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:16px;">
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;">
                    If you didn't request this, you can safely ignore this email. Someone may have entered your email
                    address by mistake.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                    Thanks,<br />
                    <span style="color:#e5e7eb;">The Vendofy Team</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

// Verify email address
app.get("/api/auth/verify-email", emailVerificationLimiter, async (req, res) => {
  try {
    const { token } = req.query as { token?: string };

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ message: "Verification token is required." });
    }

    // Sanitize token
    const sanitizedToken = token.trim();

    const tokenDoc = await EmailVerificationToken.findOne({
      token: sanitizedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: "Invalid or expired verification token." });
    }

    const user = await User.findOne({ email: tokenDoc.email });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified." });
    }

    // Mark email as verified
    user.emailVerified = true;

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    user.temporaryPassword = tempPassword;
    user.mustChangePassword = true; // Force password change on first login

    // Hash and set temporary password
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    user.password = hashedTempPassword;

    await user.save();

    // Mark token as used
    tokenDoc.used = true;
    await tokenDoc.save();

    // Send password email
    try {
      await mailTransporter.sendMail({
        from: MAIL_FROM,
        to: user.email,
        subject: "Your Account Password - Vendofy",
        html: buildPasswordEmailHtml(user.name, tempPassword),
      });
    } catch (emailError) {
      console.error("Failed to send password email:", emailError);
      // Continue even if email fails
    }

    return res.status(200).json({ 
      success: true,
      message: "Email verified successfully. Your temporary password has been sent to your email. Please change it immediately after logging in." 
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Request password reset OTP with rate limiting
app.post("/api/auth/forgot-password/request", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      // Do not reveal if user exists
      return res.status(200).json({ success: true });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PasswordResetToken.updateOne(
      { email: sanitizedEmail },
      { email: sanitizedEmail, code, expiresAt, used: false },
      { upsert: true }
    );

    await mailTransporter.sendMail({
      from: MAIL_FROM,
      to: sanitizedEmail,
      subject: "Your Vendofy password reset code",
      html: buildOtpEmailHtml(code),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Forgot password request error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Verify OTP and reset password with rate limiting
app.post("/api/auth/forgot-password/reset", passwordResetLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body as {
      email?: string;
      code?: string;
      newPassword?: string;
    };

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, code and new password are required." });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Validate password strength
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Invalid code format." });
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase();

    const tokenDoc = await PasswordResetToken.findOne({
      email: sanitizedEmail,
      code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: "Invalid or expired code." });
    }

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = false; // Clear the flag after password change
    await user.save();

    tokenDoc.used = true;
    await tokenDoc.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Forgot password reset error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Update user's own name
app.put("/api/user/name", authenticate, async (req, res) => {
  try {
    const { name } = req.body as { name?: string };

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Name is required." });
    }

    const auth = (req as any).user as { id: string };
    const user = await User.findById(auth.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent super admin from changing name
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      return res.status(403).json({ message: "Super admin name cannot be changed." });
    }

    user.name = name.trim();
    await user.save();

    return res.status(200).json({ name: user.name });
  } catch (error) {
    console.error("Update name error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Update profile photo (avatar)
app.post("/api/user/profile-photo", authenticate, async (req, res) => {
  try {
    const { avatarData } = req.body as { avatarData?: string };

    if (!avatarData || typeof avatarData !== "string") {
      return res.status(400).json({ message: "avatarData is required." });
    }

    const auth = (req as any).user as { id: string };
    const user = await User.findById(auth.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.avatarUrl = avatarData;
    await user.save();

    return res.status(200).json({ avatarUrl: user.avatarUrl });
  } catch (error) {
    console.error("Update profile photo error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Remove profile photo (avatar)
app.post("/api/user/profile-photo/remove", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const user = await User.findById(auth.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.avatarUrl = undefined;
    await user.save();

    return res.status(200).json({ avatarUrl: null });
  } catch (error) {
    console.error("Remove profile photo error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Middleware to check if user is super admin
async function requireSuperAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const auth = (req as any).user as { isSuperAdmin?: boolean };
    if (!auth?.isSuperAdmin) {
      return res.status(403).json({ message: "Super admin access required." });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized." });
  }
}

// Middleware to require admin or super admin
async function requireAdminOrSuper(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const auth = (req as any).user as { isSuperAdmin?: boolean; role?: string };
    // Allow super-admin, admin, and distributor (distributors can create customers)
    if (!auth?.isSuperAdmin && auth?.role !== "admin" && auth?.role !== "distributor") {
      return res.status(403).json({ message: "Admin or distributor access required." });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized." });
  }
}

// Get system settings (super admin can see all, admin can see limited read-only)
app.get("/api/system-settings", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { isSuperAdmin?: boolean };
    const settings = await SystemSettings.findOne();
    if (!settings) {
      const newSettings = await SystemSettings.create({});
      // Return limited fields for admin, all for super admin
      if (auth.isSuperAdmin) {
        return res.status(200).json(newSettings);
      } else {
        // Return only relevant fields for admin (read-only)
        return res.status(200).json({
          jwtSessionDuration: newSettings.jwtSessionDuration,
          passwordMinLength: newSettings.passwordMinLength,
          passwordRequireUppercase: newSettings.passwordRequireUppercase,
          passwordRequireLowercase: newSettings.passwordRequireLowercase,
          passwordRequireNumbers: newSettings.passwordRequireNumbers,
          passwordRequireSpecialChars: newSettings.passwordRequireSpecialChars,
          notificationEmailEnabled: newSettings.notificationEmailEnabled,
          notificationOnSiteEnabled: newSettings.notificationOnSiteEnabled,
          fieldRequirements: {
            distributor: newSettings.fieldRequirements?.distributor || {},
            customer: newSettings.fieldRequirements?.customer || {},
          },
        });
      }
    }
    // Return limited fields for admin, all for super admin
    if (auth.isSuperAdmin) {
      return res.status(200).json(settings);
    } else {
      // Return only relevant fields for admin (read-only) + field requirements for distributor and customer
      return res.status(200).json({
        jwtSessionDuration: settings.jwtSessionDuration,
        passwordMinLength: settings.passwordMinLength,
        passwordRequireUppercase: settings.passwordRequireUppercase,
        passwordRequireLowercase: settings.passwordRequireLowercase,
        passwordRequireNumbers: settings.passwordRequireNumbers,
        passwordRequireSpecialChars: settings.passwordRequireSpecialChars,
        notificationEmailEnabled: settings.notificationEmailEnabled,
        notificationOnSiteEnabled: settings.notificationOnSiteEnabled,
        fieldRequirements: {
          distributor: settings.fieldRequirements?.distributor || {},
          customer: settings.fieldRequirements?.customer || {},
        },
      });
    }
  } catch (error) {
    console.error("Get system settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Update system settings (super admin only)
app.put("/api/system-settings", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const updateData = req.body;
    const settings = await SystemSettings.findOne();
    
    if (!settings) {
      const newSettings = await SystemSettings.create(updateData);
      return res.status(200).json(newSettings);
    }

    Object.assign(settings, updateData);
    await settings.save();

    return res.status(200).json(settings);
  } catch (error) {
    console.error("Update system settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Submit pending field requirements change (admin only)
app.post("/api/system-settings/pending", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    
    // Only allow regular admins to submit pending changes
    if (auth.isSuperAdmin) {
      return res.status(403).json({ message: "Super admins cannot submit pending changes." });
    }

    const { fieldRequirements } = req.body;
    
    if (!fieldRequirements || (!fieldRequirements.distributor && !fieldRequirements.customer)) {
      return res.status(400).json({ message: "Field requirements for distributor or customer are required." });
    }

    // Check if there's already a pending request from this admin
    const existingPending = await PendingSettingsChange.findOne({
      requestedBy: auth.id,
      status: "pending",
    });

    if (existingPending) {
      // Update existing pending request
      existingPending.fieldRequirements = fieldRequirements;
      await existingPending.save();
      return res.status(200).json(existingPending);
    }

    // Create new pending request
    const pendingChange = await PendingSettingsChange.create({
      requestedBy: auth.id,
      fieldRequirements,
      status: "pending",
    });

    return res.status(201).json(pendingChange);
  } catch (error) {
    console.error("Submit pending settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get pending settings changes (super admin only)
app.get("/api/system-settings/pending", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const pendingChanges = await PendingSettingsChange.find({ status: "pending" })
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return res.status(200).json(pendingChanges);
  } catch (error) {
    console.error("Get pending settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get pending settings change for current admin
app.get("/api/system-settings/pending/my", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    
    if (auth.isSuperAdmin) {
      return res.status(200).json(null);
    }

    // Get the most recent change (pending, approved, or rejected) to check status
    const pendingChange = await PendingSettingsChange.findOne({
      requestedBy: auth.id,
    })
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return res.status(200).json(pendingChange);
  } catch (error) {
    console.error("Get my pending settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Approve pending settings change (super admin only)
app.post("/api/system-settings/pending/:id/approve", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = (req as any).user as { id: string };
    
    const pendingChange = await PendingSettingsChange.findById(id);
    if (!pendingChange) {
      return res.status(404).json({ message: "Pending change not found." });
    }

    if (pendingChange.status !== "pending") {
      return res.status(400).json({ message: "This change has already been processed." });
    }

    // Update system settings with approved changes
    const settings = await SystemSettings.findOne();
    if (!settings) {
      await SystemSettings.create({ fieldRequirements: pendingChange.fieldRequirements });
    } else {
      if (!settings.fieldRequirements) {
        settings.fieldRequirements = {};
      }
      // Apply distributor field requirements (only if settings weren't already updated)
      // Since settings are saved before approval, we merge to ensure consistency
      if (pendingChange.fieldRequirements?.distributor) {
        settings.fieldRequirements.distributor = {
          ...settings.fieldRequirements.distributor,
          ...pendingChange.fieldRequirements.distributor,
        };
      }
      // Apply customer field requirements (only if settings weren't already updated)
      if (pendingChange.fieldRequirements?.customer) {
        settings.fieldRequirements.customer = {
          ...settings.fieldRequirements.customer,
          ...pendingChange.fieldRequirements.customer,
        };
      }
      // Save to ensure consistency (even if already saved, this ensures the merge is persisted)
      await settings.save();
    }

    // Update pending change status
    pendingChange.status = "approved";
    pendingChange.reviewedBy = new mongoose.Types.ObjectId(auth.id);
    pendingChange.reviewedAt = new Date();
    await pendingChange.save();

    return res.status(200).json({ message: "Settings change approved and applied." });
  } catch (error) {
    console.error("Approve pending settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Reject pending settings change (super admin only)
app.post("/api/system-settings/pending/:id/reject", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const auth = (req as any).user as { id: string };
    
    const pendingChange = await PendingSettingsChange.findById(id);
    if (!pendingChange) {
      return res.status(404).json({ message: "Pending change not found." });
    }

    if (pendingChange.status !== "pending") {
      return res.status(400).json({ message: "This change has already been processed." });
    }

    // Update pending change status
    pendingChange.status = "rejected";
    pendingChange.reviewedBy = new mongoose.Types.ObjectId(auth.id);
    pendingChange.reviewedAt = new Date();
    pendingChange.rejectionReason = reason || "Rejected by super admin";
    await pendingChange.save();

    return res.status(200).json({ message: "Settings change rejected." });
  } catch (error) {
    console.error("Reject pending settings error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get products (admin and super admin)
app.get("/api/products", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const auth = (req as any).user as { isSuperAdmin?: boolean };
    
    const filter: any = {};
    
    // Super admin can see all products, admin can only see approved products
    if (!auth.isSuperAdmin) {
      filter.status = "approved";
      filter.isActive = true;
    } else if (status) {
      filter.status = status;
    }
    
    const products = await Product.find(filter)
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return res.status(200).json(products);
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get pending products for review (super admin only)
app.get("/api/products/pending", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const products = await Product.find({ status: "pending" })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return res.status(200).json(products);
  } catch (error) {
    console.error("Get pending products error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Create product (admin creates as pending, super admin creates as approved)
app.post("/api/products", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      imageUrl,
      stock,
      category,
    } = req.body as {
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      stock?: number;
      category?: string;
    };

    if (!name || !price) {
      return res.status(400).json({ message: "Name and price are required." });
    }

    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const creator = await User.findById(auth.id);
    if (!creator) {
      return res.status(401).json({ message: "User not found." });
    }

    // Super admin creates as approved, admin creates as pending
    const status = auth.isSuperAdmin ? "approved" : "pending";

    const product = await Product.create({
      name,
      description,
      price,
      imageUrl: imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : undefined,
      stock: stock !== undefined && stock !== null ? stock : undefined,
      category,
      isActive: true,
      status,
      createdBy: creator._id,
    });

    const populatedProduct = await Product.findById(product._id)
      .populate("createdBy", "name email")
      .lean()
      .exec();

    return res.status(201).json(populatedProduct);
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Update product (admin updates go to pending, super admin updates are immediate)
app.put("/api/products/:id", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      imageUrl,
      stock,
      category,
      isActive,
    } = req.body as {
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      stock?: number;
      category?: string;
      isActive?: boolean;
    };

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };

    // Update fields
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (imageUrl !== undefined) {
      product.imageUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : undefined;
    }
    if (stock !== undefined) {
      // If stock is explicitly null, remove stock tracking
      if (stock === null) {
        product.stock = undefined;
      } else {
        product.stock = stock;
      }
    }
    if (category !== undefined) product.category = category;
    if (isActive !== undefined && auth.isSuperAdmin) product.isActive = isActive;

    // If admin updates, set status to pending for review
    // If super admin updates, keep current status or set to approved
    if (!auth.isSuperAdmin) {
      product.status = "pending";
    } else if (product.status === "rejected") {
      product.status = "approved"; // Super admin can override rejection
    }

    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .lean()
      .exec();

    return res.status(200).json(populatedProduct);
  } catch (error) {
    console.error("Update product error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Delete product (super admin only)
app.delete("/api/products/:id", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    await Product.findByIdAndDelete(id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Approve product (super admin only)
app.post("/api/products/:id/approve", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const auth = (req as any).user as { id: string };
    const reviewer = await User.findById(auth.id);
    if (!reviewer) {
      return res.status(401).json({ message: "Reviewer not found." });
    }

    product.status = "approved";
    product.reviewedBy = reviewer._id;
    product.reviewedAt = new Date();
    product.rejectionReason = undefined;
    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .lean()
      .exec();

    return res.status(200).json(populatedProduct);
  } catch (error) {
    console.error("Approve product error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Reject product (super admin only)
app.post("/api/products/:id/reject", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const auth = (req as any).user as { id: string };
    const reviewer = await User.findById(auth.id);
    if (!reviewer) {
      return res.status(401).json({ message: "Reviewer not found." });
    }

    product.status = "rejected";
    product.reviewedBy = reviewer._id;
    product.reviewedAt = new Date();
    product.rejectionReason = reason || "Rejected by super admin";
    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .lean()
      .exec();

    return res.status(200).json(populatedProduct);
  } catch (error) {
    console.error("Reject product error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ==================== CUSTOMER PRICING APIs ====================
// Get all customer pricing for a distributor
app.get("/api/distributor/customer-pricing", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const pricing = await CustomerPricing.find({ distributorId: distributor._id })
      .populate("customerId", "name email")
      .populate("productId", "name price imageUrl")
      .lean()
      .exec();

    return res.status(200).json(pricing);
  } catch (error) {
    console.error("Get customer pricing error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Set/Update customer pricing (distributor only)
app.post("/api/distributor/customer-pricing", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const { customerId, productId, customPrice } = req.body as {
      customerId: string;
      productId: string;
      customPrice: number;
    };

    if (!customerId || !productId || customPrice === undefined) {
      return res.status(400).json({ message: "customerId, productId, and customPrice are required." });
    }

    // Verify customer belongs to this distributor
    const customer = await User.findById(customerId);
    if (!customer || customer.role !== "customer" || customer.parentId?.toString() !== distributor._id.toString()) {
      return res.status(403).json({ message: "Customer not found or doesn't belong to you." });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const pricing = await CustomerPricing.findOneAndUpdate(
      { distributorId: distributor._id, customerId, productId },
      { customPrice },
      { upsert: true, new: true }
    )
      .populate("customerId", "name email")
      .populate("productId", "name price imageUrl")
      .lean()
      .exec();

    return res.status(200).json(pricing);
  } catch (error) {
    console.error("Set customer pricing error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Delete customer pricing
app.delete("/api/distributor/customer-pricing/:id", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const pricing = await CustomerPricing.findById(req.params.id);
    if (!pricing || pricing.distributorId.toString() !== distributor._id.toString()) {
      return res.status(404).json({ message: "Pricing not found." });
    }

    await CustomerPricing.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Pricing deleted successfully." });
  } catch (error) {
    console.error("Delete customer pricing error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ==================== CUSTOMER PRODUCT APIs ====================
// Get distributor's customers
app.get("/api/distributor/customers", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const customers = await User.find({
      parentId: distributor._id,
      role: "customer",
      isActive: true,
    })
      .select("name email _id")
      .sort({ name: 1 })
      .lean()
      .exec();

    return res.status(200).json(customers);
  } catch (error) {
    console.error("Get distributor customers error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get products available to distributor (products that admin has used for this distributor)
app.get("/api/distributor/products", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    // Get distributor's admin
    const adminId = distributor.parentId || distributor.createdBy;
    if (!adminId) {
      return res.status(400).json({ message: "No admin associated with distributor." });
    }

    // Get products that the admin has "used" (has pricing set for this distributor)
    const adminPricing = await AdminProductPricing.find({
      adminId,
      distributorId: distributor._id,
      isActive: true,
    })
      .populate("productId")
      .lean()
      .exec();

    // Filter and transform products
    const products = adminPricing
      .filter((p) => p.productId && (p.productId as any).status === "approved" && (p.productId as any).isActive)
      .map((p) => {
        const product = p.productId as any;
        return {
          _id: product._id,
          name: product.name,
          price: p.customPrice || product.price,
          imageUrl: product.imageUrl,
          description: product.description,
          category: product.category,
        };
      });

    return res.status(200).json(products);
  } catch (error) {
    console.error("Get distributor products error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get products available to customer (with custom pricing if set)
app.get("/api/customer/products", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const customer = await User.findById(auth.id);
    if (!customer || customer.role !== "customer") {
      return res.status(403).json({ message: "Access denied. Customer only." });
    }

    // Get customer's distributor
    if (!customer.parentId) {
      return res.status(400).json({ message: "Customer has no associated distributor." });
    }

    const distributor = await User.findById(customer.parentId);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(400).json({ message: "Distributor not found." });
    }

    // Get distributor's admin
    const adminId = distributor.parentId || distributor.createdBy;
    if (!adminId) {
      return res.status(400).json({ message: "No admin associated with distributor." });
    }

    // Get products that the admin has "used" (has pricing set for this distributor)
    const adminPricing = await AdminProductPricing.find({
      adminId,
      distributorId: distributor._id,
      isActive: true,
    })
      .populate("productId")
      .lean()
      .exec();

    // Get custom pricing for this customer (distributor-customer pricing)
    const customerPricing = await CustomerPricing.find({
      customerId: customer._id,
      distributorId: distributor._id,
    }).lean().exec();

    const customerPricingMap = new Map(customerPricing.map((p) => [p.productId.toString(), p.customPrice]));

    // Build products list from admin pricing
    const productsWithPricing = adminPricing
      .filter((p) => p.productId && (p.productId as any).status === "approved" && (p.productId as any).isActive)
      .map((p) => {
        const product = p.productId as any;
        const customerPrice = customerPricingMap.get(product._id.toString());
        return {
          ...product,
          price: customerPrice || p.customPrice || product.price,
          hasCustomPrice: customerPricingMap.has(product._id.toString()) || p.customPrice !== product.price,
        };
      });

    return res.status(200).json(productsWithPricing);
  } catch (error) {
    console.error("Get customer products error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ==================== ORDER APIs ====================
// Create order (customer only)
app.post("/api/customer/orders", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const customer = await User.findById(auth.id);
    if (!customer || customer.role !== "customer") {
      return res.status(403).json({ message: "Access denied. Customer only." });
    }

    const { items, desiredDeliveryDate } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
      desiredDeliveryDate: string;
    };

    if (!items || items.length === 0 || !desiredDeliveryDate) {
      return res.status(400).json({ message: "items and desiredDeliveryDate are required." });
    }

    // Get customer's distributor and admin
    if (!customer.parentId) {
      return res.status(400).json({ message: "Customer has no associated distributor." });
    }

    const distributor = await User.findById(customer.parentId);
    if (!distributor) {
      return res.status(400).json({ message: "Distributor not found." });
    }

    const adminId = distributor.parentId || distributor.createdBy;
    if (!adminId) {
      return res.status(400).json({ message: "No admin associated with distributor." });
    }

    // Get admin pricing for this distributor (products admin has used)
    const adminPricing = await AdminProductPricing.find({
      adminId,
      distributorId: distributor._id,
      isActive: true,
    }).lean().exec();

    const adminPricingMap = new Map(adminPricing.map((p) => [p.productId.toString(), p.customPrice]));

    // Get custom pricing for this customer (distributor-customer pricing)
    const customPricing = await CustomerPricing.find({
      customerId: customer._id,
      distributorId: distributor._id,
    }).lean().exec();

    const customerPricingMap = new Map(customPricing.map((p) => [p.productId.toString(), p.customPrice]));

    // Calculate total and build order items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || product.status !== "approved" || !product.isActive) {
        return res.status(400).json({ message: `Product ${item.productId} not found or not available.` });
      }

      // Price hierarchy: customer-specific price > admin-set distributor price > base product price
      const price = customerPricingMap.get(item.productId) || adminPricingMap.get(item.productId) || product.price;
      const itemTotal = price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product._id,
        quantity: item.quantity,
        price,
      });
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const deliveryDate = new Date(desiredDeliveryDate);
    const order = await Order.create({
      orderNumber,
      customerId: customer._id,
      distributorId: distributor._id,
      adminId,
      items: orderItems,
      totalAmount,
      status: "pending",
      desiredDeliveryDate: deliveryDate,
      currentDeliveryDate: deliveryDate,
    });

    const populatedOrder = await Order.findById(order._id)
      .populate("customerId", "name email")
      .populate("distributorId", "name email")
      .populate("items.productId", "name imageUrl")
      .lean()
      .exec();

    return res.status(201).json(populatedOrder);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get customer orders
app.get("/api/customer/orders", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const customer = await User.findById(auth.id);
    if (!customer || customer.role !== "customer") {
      return res.status(403).json({ message: "Access denied. Customer only." });
    }

    const orders = await Order.find({ customerId: customer._id })
      .populate("items.productId", "name imageUrl")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Get customer orders error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Mark order as received (customer)
app.post("/api/customer/orders/:id/receive", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const customer = await User.findById(auth.id);
    if (!customer || customer.role !== "customer") {
      return res.status(403).json({ message: "Access denied. Customer only." });
    }

    const order = await Order.findById(req.params.id);
    if (!order || order.customerId.toString() !== customer._id.toString()) {
      return res.status(404).json({ message: "Order not found or doesn't belong to you." });
    }

    if (order.receivedAt) {
      return res.status(400).json({ message: "Order already marked as received." });
    }

    order.receivedAt = new Date();
    order.status = "delivered";
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("items.productId", "name imageUrl")
      .lean()
      .exec();

    return res.status(200).json(populatedOrder);
  } catch (error) {
    console.error("Mark order as received error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Delete order (customer can delete their own orders, admin/super admin can delete any)
app.delete("/api/orders/:id", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const user = await User.findById(auth.id);
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Check permissions: customer can only delete their own orders, admin/super admin can delete any
    if (user.role === "customer") {
      if (order.customerId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "Access denied. You can only delete your own orders." });
      }
    } else if (user.role !== "admin" && !auth.isSuperAdmin) {
      return res.status(403).json({ message: "Access denied. Only customers, admins, and super admins can delete orders." });
    }

    await Order.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Order deleted successfully." });
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Update payment amount (customer)
app.put("/api/customer/orders/:id/payment", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const customer = await User.findById(auth.id);
    if (!customer || customer.role !== "customer") {
      return res.status(403).json({ message: "Access denied. Customer only." });
    }

    const { amountPaid } = req.body as { amountPaid: number };
    if (amountPaid === undefined || amountPaid < 0) {
      return res.status(400).json({ message: "Valid amountPaid is required." });
    }

    const order = await Order.findById(req.params.id);
    if (!order || order.customerId.toString() !== customer._id.toString()) {
      return res.status(404).json({ message: "Order not found or doesn't belong to you." });
    }

    if (!order.receivedAt) {
      return res.status(400).json({ message: "Order must be marked as received first." });
    }

    order.amountPaid = amountPaid;
    if (amountPaid === 0) {
      order.paymentStatus = "pending";
    } else if (amountPaid < order.totalAmount) {
      order.paymentStatus = "partial";
    } else {
      order.paymentStatus = "paid";
    }
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("items.productId", "name imageUrl")
      .lean()
      .exec();

    return res.status(200).json(populatedOrder);
  } catch (error) {
    console.error("Update payment error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get distributor orders (grouped by delivery date)
app.get("/api/distributor/orders", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const orders = await Order.find({ 
      distributorId: distributor._id, 
      status: { $ne: "delivered" } 
    })
      .populate("customerId", "name email")
      .populate("items.productId", "name imageUrl")
      .select("orderNumber customerId items totalAmount desiredDeliveryDate currentDeliveryDate markedForToday sentToAdmin sentToAdminAt receivedAt status createdAt")
      .sort({ currentDeliveryDate: 1, createdAt: -1 })
      .lean()
      .exec();

    // Group orders by delivery date
    const ordersByDate: Record<string, typeof orders> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    orders.forEach((order) => {
      const deliveryDate = new Date(order.currentDeliveryDate);
      deliveryDate.setHours(0, 0, 0, 0);
      const dateKey = deliveryDate.toISOString().split("T")[0];

      if (!ordersByDate[dateKey]) {
        ordersByDate[dateKey] = [];
      }
      ordersByDate[dateKey].push(order);
    });

    return res.status(200).json({ ordersByDate, allOrders: orders });
  } catch (error) {
    console.error("Get distributor orders error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Mark orders for today (distributor)
app.post("/api/distributor/orders/mark-for-today", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const { orderIds } = req.body as { orderIds: string[] };

    if (!orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ message: "orderIds array is required." });
    }

    // Verify all orders belong to this distributor
    const orders = await Order.find({
      _id: { $in: orderIds },
      distributorId: distributor._id,
    });

    if (orders.length !== orderIds.length) {
      return res.status(403).json({ message: "Some orders not found or don't belong to you." });
    }

    // Update orders
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { markedForToday: true, currentDeliveryDate: new Date() }
    );

    return res.status(200).json({ message: "Orders marked for today." });
  } catch (error) {
    console.error("Mark orders for today error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Send orders to admin (distributor)
app.post("/api/distributor/orders/send-to-admin", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const { orderIds } = req.body as { orderIds: string[] };

    if (!orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ message: "orderIds array is required." });
    }

    // Verify all orders belong to this distributor (markedForToday check removed to allow sending any order)
    const orders = await Order.find({
      _id: { $in: orderIds },
      distributorId: distributor._id,
    }).populate("items.productId", "name").lean().exec();

    if (orders.length !== orderIds.length) {
      return res.status(403).json({ message: "Some orders not found or don't belong to you." });
    }

    // Get admin
    const adminId = distributor.parentId || distributor.createdBy;
    if (!adminId) {
      return res.status(400).json({ message: "No admin associated with this distributor." });
    }

    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // Aggregate items by product
    const itemsByProduct = new Map<string, { productId: string; productName: string; totalQuantity: number }>();

    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        const productId = item.productId._id.toString();
        const existing = itemsByProduct.get(productId);
        if (existing) {
          existing.totalQuantity += item.quantity;
        } else {
          itemsByProduct.set(productId, {
            productId,
            productName: item.productId.name,
            totalQuantity: item.quantity,
          });
        }
      });
    });

    const itemsSummary = Array.from(itemsByProduct.values());

    // Update orders
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { sentToAdmin: true, sentToAdminAt: new Date() }
    );

    // Send email to admin
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Order Request from Distributor</h2>
        <p>Distributor: ${distributor.name} (${distributor.email})</p>
        <p>Orders: ${orders.length}</p>
        <h3>Items Required:</h3>
        <ul>
          ${itemsSummary.map((item) => `<li>${item.productName}: ${item.totalQuantity} units</li>`).join("")}
        </ul>
        <p>Please check your dashboard for more details.</p>
      </div>
    `;

    try {
      await mailTransporter.sendMail({
        from: MAIL_FROM,
        to: admin.email,
        subject: `New Order Request from ${distributor.name}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      message: "Orders sent to admin successfully.",
      itemsSummary,
      ordersCount: orders.length,
    });
  } catch (error) {
    console.error("Send orders to admin error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ==================== ADMIN PRODUCT USAGE APIs ====================
// Get available products for admin to use (approved products)
app.get("/api/admin/products/available", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin || (admin.role !== "admin" && !auth.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    // Get all approved products
    const products = await Product.find({ status: "approved", isActive: true })
      .select("name description price imageUrl category")
      .lean()
      .exec();

    return res.status(200).json(products);
  } catch (error) {
    console.error("Get available products error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get admin's used products with pricing
app.get("/api/admin/products/used", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin || (admin.role !== "admin" && !auth.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    // Get all pricing entries for this admin
    const pricing = await AdminProductPricing.find({ adminId: admin._id, isActive: true })
      .populate("distributorId", "name email")
      .populate("productId", "name price imageUrl description")
      .lean()
      .exec();

    // Group by product
    const productsMap = new Map();
    pricing.forEach((p: any) => {
      const productId = (p.productId as any)._id.toString();
      if (!productsMap.has(productId)) {
        productsMap.set(productId, {
          product: p.productId,
          distributors: [],
        });
      }
      const distributor = p.distributorId as any;
      productsMap.get(productId).distributors.push({
        distributorId: distributor._id,
        distributorName: distributor.name,
        distributorEmail: distributor.email,
        customPrice: p.customPrice,
        pricingId: p._id,
      });
    });

    return res.status(200).json(Array.from(productsMap.values()));
  } catch (error) {
    console.error("Get used products error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Use a product (set pricing for distributors)
app.post("/api/admin/products/use", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin || (admin.role !== "admin" && !auth.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { productId, distributorPricing } = req.body as {
      productId: string;
      distributorPricing: Array<{ distributorId: string; customPrice: number }>;
    };

    if (!productId || !distributorPricing || !Array.isArray(distributorPricing)) {
      return res.status(400).json({ message: "productId and distributorPricing array are required." });
    }

    // Verify product exists and is approved
    const product = await Product.findById(productId);
    if (!product || product.status !== "approved" || !product.isActive) {
      return res.status(404).json({ message: "Product not found or not available." });
    }

    // Verify all distributors belong to this admin
    const distributorIds = distributorPricing.map((p) => p.distributorId);
    const distributors = await User.find({
      _id: { $in: distributorIds },
      role: "distributor",
      parentId: admin._id,
    });

    if (distributors.length !== distributorIds.length) {
      return res.status(403).json({ message: "Some distributors not found or don't belong to you." });
    }

    // Create or update pricing entries
    const pricingEntries = [];
    for (const pricing of distributorPricing) {
      const entry = await AdminProductPricing.findOneAndUpdate(
        { adminId: admin._id, distributorId: pricing.distributorId, productId },
        { customPrice: pricing.customPrice, isActive: true },
        { upsert: true, new: true }
      )
        .populate("distributorId", "name email")
        .populate("productId", "name price imageUrl")
        .lean()
        .exec();
      pricingEntries.push(entry);
    }

    return res.status(200).json({ message: "Product pricing set successfully.", pricing: pricingEntries });
  } catch (error) {
    console.error("Use product error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Update pricing for a specific distributor-product combination
app.put("/api/admin/products/pricing/:id", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin || (admin.role !== "admin" && !auth.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { customPrice } = req.body as { customPrice: number };

    if (customPrice === undefined) {
      return res.status(400).json({ message: "customPrice is required." });
    }

    const pricing = await AdminProductPricing.findById(req.params.id);
    if (!pricing || pricing.adminId.toString() !== admin._id.toString()) {
      return res.status(404).json({ message: "Pricing not found or doesn't belong to you." });
    }

    pricing.customPrice = customPrice;
    await pricing.save();

    const populated = await AdminProductPricing.findById(pricing._id)
      .populate("distributorId", "name email")
      .populate("productId", "name price imageUrl")
      .lean()
      .exec();

    return res.status(200).json(populated);
  } catch (error) {
    console.error("Update pricing error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Remove product usage (deactivate pricing)
app.delete("/api/admin/products/pricing/:id", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin || (admin.role !== "admin" && !auth.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const pricing = await AdminProductPricing.findById(req.params.id);
    if (!pricing || pricing.adminId.toString() !== admin._id.toString()) {
      return res.status(404).json({ message: "Pricing not found or doesn't belong to you." });
    }

    pricing.isActive = false;
    await pricing.save();

    return res.status(200).json({ message: "Product pricing removed successfully." });
  } catch (error) {
    console.error("Remove pricing error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get distributors for admin
app.get("/api/admin/distributors", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin || (admin.role !== "admin" && !auth.isSuperAdmin)) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const distributors = await User.find({ parentId: admin._id, role: "distributor", isActive: true })
      .select("name email")
      .lean()
      .exec();

    return res.status(200).json(distributors);
  } catch (error) {
    console.error("Get distributors error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get admin order notifications
app.get("/api/admin/order-notifications", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin) {
      return res.status(401).json({ message: "User not found." });
    }

    let filter: any = { sentToAdmin: true };

    if (!auth.isSuperAdmin && admin.role === "admin") {
      // Regular admin sees only their distributors' orders
      const distributorIds = await User.find({ parentId: admin._id, role: "distributor" })
        .select("_id")
        .lean()
        .exec();
      const distributorObjectIds = distributorIds.map((d) => d._id);
      filter.distributorId = { $in: distributorObjectIds };
    }
    // Super admin sees all

    const notifications = await Order.find(filter)
      .populate("customerId", "name email")
      .populate("distributorId", "name email")
      .populate("items.productId", "name imageUrl")
      .sort({ sentToAdminAt: -1 })
      .lean()
      .exec();

    // Filter out orders that have been received by admin OR received by distributor
    // (if distributor received it, admin notification should be cleared)
    const unreadNotifications = notifications.filter((n: any) => 
      !n.adminReceivedAt && !n.receivedAt
    );

    return res.status(200).json(unreadNotifications);
  } catch (error) {
    console.error("Get admin order notifications error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Shift order to next day (distributor)
// Update delivery date (distributor) - with customer notification
app.put("/api/distributor/orders/:id/update-delivery-date", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const { deliveryDate } = req.body as { deliveryDate: string };
    if (!deliveryDate) {
      return res.status(400).json({ message: "deliveryDate is required." });
    }

    const order = await Order.findById(req.params.id)
      .populate("customerId", "name email")
      .lean()
      .exec();
    
    if (!order || order.distributorId?.toString() !== distributor._id.toString()) {
      return res.status(404).json({ message: "Order not found or doesn't belong to you." });
    }

    // Update delivery date (only currentDeliveryDate, preserve original desiredDeliveryDate)
    const newDeliveryDate = new Date(deliveryDate);
    await Order.findByIdAndUpdate(req.params.id, {
      currentDeliveryDate: newDeliveryDate,
    });

    // Send email notification to customer
    const customer = order.customerId as any;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Delivery Date Update</h2>
        <p>Dear ${customer.name},</p>
        <p>Your order #${order.orderNumber} delivery date has been updated.</p>
        <p><strong>Possible Transit Date:</strong> ${newDeliveryDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>Please note that this is a possible transit date and may be subject to change.</p>
        <p>Thank you for your patience.</p>
      </div>
    `;

    try {
      await mailTransporter.sendMail({
        from: MAIL_FROM,
        to: customer.email,
        subject: `Order #${order.orderNumber} - Delivery Date Update`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't fail the request if email fails
    }

    const updatedOrder = await Order.findById(req.params.id).lean().exec();
    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Update delivery date error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Mark order notification as received by admin
app.post("/api/admin/order-notifications/:id/mark-received", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const admin = await User.findById(auth.id);
    if (!admin) {
      return res.status(401).json({ message: "User not found." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Check if admin has access to this order
    if (!auth.isSuperAdmin && admin.role === "admin") {
      const distributorIds = await User.find({ parentId: admin._id, role: "distributor" })
        .select("_id")
        .lean()
        .exec();
      const distributorObjectIds = distributorIds.map((d) => d._id);
      if (!distributorObjectIds.some(id => id.toString() === order.distributorId?.toString())) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    // Mark as received
    order.adminReceivedAt = new Date();
    await order.save();

    return res.status(200).json({ message: "Order marked as received." });
  } catch (error) {
    console.error("Mark order notification as received error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Mark multiple order notifications as received by admin
app.post("/api/admin/order-notifications/mark-received-bulk", authenticate, requireAdminOrSuper, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string; isSuperAdmin?: boolean };
    const { orderIds } = req.body as { orderIds: string[] };
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds array is required." });
    }

    const admin = await User.findById(auth.id);
    if (!admin) {
      return res.status(401).json({ message: "User not found." });
    }

    let filter: any = { _id: { $in: orderIds } };

    // Check if admin has access to these orders
    if (!auth.isSuperAdmin && admin.role === "admin") {
      const distributorIds = await User.find({ parentId: admin._id, role: "distributor" })
        .select("_id")
        .lean()
        .exec();
      const distributorObjectIds = distributorIds.map((d) => d._id);
      filter.distributorId = { $in: distributorObjectIds };
    }

    // Mark all as received by distributor - this also clears admin notifications
    await Order.updateMany(filter, { 
      receivedAt: new Date(),
      adminReceivedAt: new Date() 
    });

    return res.status(200).json({ message: "Orders marked as received." });
  } catch (error) {
    console.error("Mark order notifications as received bulk error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Get distributor in-transit orders count
app.get("/api/distributor/orders/in-transit-count", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const count = await Order.countDocuments({
      distributorId: distributor._id,
      markedForToday: true,
      receivedAt: { $exists: false },
    });

    return res.status(200).json({ count });
  } catch (error) {
    console.error("Get in-transit orders count error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Mark order as received by distributor
app.post("/api/distributor/orders/:id/mark-received", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.distributorId?.toString() !== distributor._id.toString()) {
      return res.status(403).json({ message: "Access denied. Order doesn't belong to you." });
    }

    if (!order.markedForToday) {
      return res.status(400).json({ message: "Order must be in transit to mark as received." });
    }

    if (order.receivedAt) {
      return res.status(400).json({ message: "Order already marked as received." });
    }

    // Mark as received by distributor - this also clears admin notification
    order.receivedAt = new Date();
    // Also mark as received by admin to clear notification
    order.adminReceivedAt = new Date();
    await order.save();

    return res.status(200).json({ message: "Order marked as received." });
  } catch (error) {
    console.error("Mark order as received error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// Mark multiple orders as received by distributor
app.post("/api/distributor/orders/mark-received-bulk", authenticate, async (req, res) => {
  try {
    const auth = (req as any).user as { id: string };
    const { orderIds } = req.body as { orderIds: string[] };
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds array is required." });
    }

    const distributor = await User.findById(auth.id);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(403).json({ message: "Access denied. Distributor only." });
    }

    // Verify all orders belong to this distributor and are in transit
    const orders = await Order.find({
      _id: { $in: orderIds },
      distributorId: distributor._id,
      markedForToday: true,
      receivedAt: { $exists: false },
    });

    if (orders.length !== orderIds.length) {
      return res.status(403).json({ message: "Some orders not found, don't belong to you, or are not in transit." });
    }

    // Mark all as received by distributor - this also clears admin notifications
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { 
        receivedAt: new Date(),
        adminReceivedAt: new Date() 
      }
    );

    return res.status(200).json({ message: "Orders marked as received." });
  } catch (error) {
    console.error("Mark orders as received bulk error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// MongoDB connection handler for serverless environments
let isConnected = false;

async function connectToMongoDB() {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log("Connected to MongoDB");
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    isConnected = false;
    throw error;
  }
}

// Connect to MongoDB on module load (for serverless)
// Only start the HTTP server if not in Vercel environment
if (!process.env.VERCEL) {
  // In local development, start the server
  async function start() {
    try {
      await connectToMongoDB();
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error("Failed to start server", error);
      process.exit(1);
    }
  }
  start();
} else {
  // In Vercel, just connect to MongoDB (don't start HTTP server)
  // The connection will be established when the function is invoked
  connectToMongoDB().catch(console.error);
}

// Export the app for Vercel
export default app;

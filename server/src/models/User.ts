import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "super-admin" | "admin" | "distributor" | "customer";
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  mustChangePassword?: boolean;
  uid?: string; // Unique ID
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
  registrationCopyUrl?: string; // URL to uploaded registration document
  createdBy?: mongoose.Types.ObjectId; // User who created this account
  parentId?: mongoose.Types.ObjectId; // Immediate parent (admin for distributor, distributor for customer)
  emailVerified?: boolean; // Whether email has been verified
  temporaryPassword?: string; // Temporary password sent after verification
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super-admin", "admin", "distributor", "customer"],
      default: "customer",
    },
    avatarUrl: { type: String },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
    uid: { type: String, unique: true, sparse: true }, // Sparse index allows multiple nulls
    mobileNo: { type: String },
    businessName: { type: String },
    address: {
      address1: { type: String },
      address2: { type: String },
      city: { type: String },
      district: { type: String },
      pin: { type: String },
      state: { type: String },
      country: { type: String },
    },
    registrationNo: { type: String },
    registrationCopyUrl: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    parentId: { type: Schema.Types.ObjectId, ref: "User" },
    emailVerified: { type: Boolean, default: false },
    temporaryPassword: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);



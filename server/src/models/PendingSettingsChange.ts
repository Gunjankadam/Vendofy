import mongoose, { Schema, Document } from "mongoose";

export interface IPendingSettingsChange extends Document {
  requestedBy: mongoose.Types.ObjectId;
  fieldRequirements?: {
    distributor?: {
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
    customer?: {
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
  };
  status: "pending" | "approved" | "rejected";
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PendingSettingsChangeSchema = new Schema<IPendingSettingsChange>(
  {
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fieldRequirements: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export const PendingSettingsChange = mongoose.model<IPendingSettingsChange>(
  "PendingSettingsChange",
  PendingSettingsChangeSchema
);


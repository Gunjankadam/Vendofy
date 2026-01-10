import mongoose, { Schema, Document } from "mongoose";

export interface IAdminProductPricing extends Document {
  adminId: mongoose.Types.ObjectId;
  distributorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  customPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminProductPricingSchema = new Schema<IAdminProductPricing>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    distributorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    customPrice: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound index to ensure unique pricing per admin-distributor-product combination
AdminProductPricingSchema.index({ adminId: 1, distributorId: 1, productId: 1 }, { unique: true });

export const AdminProductPricing = mongoose.model<IAdminProductPricing>("AdminProductPricing", AdminProductPricingSchema);


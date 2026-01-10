import mongoose, { Schema, Document } from "mongoose";

export interface ICustomerPricing extends Document {
  distributorId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  customPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerPricingSchema = new Schema<ICustomerPricing>(
  {
    distributorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    customPrice: { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound index to ensure unique pricing per distributor-customer-product combination
CustomerPricingSchema.index({ distributorId: 1, customerId: 1, productId: 1 }, { unique: true });

export const CustomerPricing = mongoose.model<ICustomerPricing>("CustomerPricing", CustomerPricingSchema);


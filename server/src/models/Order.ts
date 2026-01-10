import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  distributorId?: mongoose.Types.ObjectId;
  adminId?: mongoose.Types.ObjectId;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  desiredDeliveryDate: Date;
  currentDeliveryDate: Date;
  markedForToday?: boolean;
  sentToAdmin?: boolean;
  sentToAdminAt?: Date;
  adminReceivedAt?: Date;
  receivedAt?: Date;
  amountPaid?: number;
  paymentStatus?: "pending" | "partial" | "paid";
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    distributorId: { type: Schema.Types.ObjectId, ref: "User" },
    adminId: { type: Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    desiredDeliveryDate: { type: Date, required: true },
    currentDeliveryDate: { type: Date, required: true },
    markedForToday: { type: Boolean, default: false },
    sentToAdmin: { type: Boolean, default: false },
    sentToAdminAt: { type: Date },
    adminReceivedAt: { type: Date },
    receivedAt: { type: Date },
    amountPaid: { type: Number },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);


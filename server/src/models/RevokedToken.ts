import mongoose, { Schema, Document } from "mongoose";

export interface IRevokedToken extends Document {
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const RevokedTokenSchema = new Schema<IRevokedToken>({
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Automatically remove expired revoked tokens
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken = mongoose.model<IRevokedToken>(
  "RevokedToken",
  RevokedTokenSchema
);



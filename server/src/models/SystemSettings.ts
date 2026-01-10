import mongoose, { Schema, Document } from "mongoose";

export interface ISystemSettings extends Document {
  // Global configuration
  emailFromAddress?: string;
  smtpStatus?: "active" | "inactive";

  // Authentication & security
  jwtSessionDuration?: number; // in hours
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordRequireNumbers?: boolean;
  passwordRequireSpecialChars?: boolean;

  // App behavior
  featureToggles?: {
    [key: string]: boolean;
  };
  notificationEmailEnabled?: boolean;
  notificationOnSiteEnabled?: boolean;

  // Field requirements per role
  fieldRequirements?: {
    admin?: {
      name?: boolean;
      email?: boolean;
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
    distributor?: {
      name?: boolean;
      email?: boolean;
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
    customer?: {
      name?: boolean;
      email?: boolean;
      mobileNo?: boolean;
      businessName?: boolean;
      address?: boolean;
      registrationNo?: boolean;
      registrationCopy?: boolean;
    };
  };
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    emailFromAddress: { type: String },
    smtpStatus: { type: String, enum: ["active", "inactive"], default: "active" },

    jwtSessionDuration: { type: Number, default: 3600 }, // in seconds (default: 1 hour)
    passwordMinLength: { type: Number, default: 8 },
    passwordRequireUppercase: { type: Boolean, default: false },
    passwordRequireLowercase: { type: Boolean, default: false },
    passwordRequireNumbers: { type: Boolean, default: false },
    passwordRequireSpecialChars: { type: Boolean, default: false },

    featureToggles: { type: Schema.Types.Mixed, default: {} },
    notificationEmailEnabled: { type: Boolean, default: true },
    notificationOnSiteEnabled: { type: Boolean, default: true },
    fieldRequirements: {
      type: Schema.Types.Mixed,
      default: {
        admin: {},
        distributor: {},
        customer: {},
      },
    },
  },
  { timestamps: true }
);


export const SystemSettings = mongoose.model<ISystemSettings>(
  "SystemSettings",
  SystemSettingsSchema
);


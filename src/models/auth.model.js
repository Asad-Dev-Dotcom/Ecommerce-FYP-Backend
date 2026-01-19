import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Auth Schema
const authSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    role: {
      type: String,
      enum: ["admin", "client"],
      required: true,
    },
    image: {
      public_id: { type: String },
      url: { type: String },
    },
    refreshToken: { type: String, default: null },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
  },
  { timestamps: true }
);

// Hash password before save
authSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) return next();
  const hashedPassword = await bcrypt.hash(user.password, 10);
  user.password = hashedPassword;
  return next();
});

export const Auth = mongoose.model("Auth", authSchema);

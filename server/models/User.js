const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  first:    { type: String, required: true },
  last:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone:    { type: String, default: "" },
  bio:      { type: String, default: "" },
  location: { type: String, default: "" },
  avatar:   { type: String, default: null },
  role:     { type: String, enum: ["user", "admin"], default: "user" },
  verified: { type: Boolean, default: false },
  subscription: {
    plan:      { type: String, enum: ["none", "monthly", "yearly"], default: "none" },
    status:    { type: String, enum: ["inactive", "active", "expired"], default: "inactive" },
    startDate: { type: Date, default: null },
    endDate:   { type: Date, default: null },
    method:    { type: String, default: "" }, // visa, mastercard, mtn, airtel
  },
  resetToken:       { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

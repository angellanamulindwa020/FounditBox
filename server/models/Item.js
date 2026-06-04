const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema({
  claimedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  claimedByName: { type: String },
  claimDate:     { type: Date, default: Date.now },
  claimStatus:   { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  message:       { type: String, default: "" },
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  status:      { type: String, enum: ["Lost", "Found", "Returned"], required: true },
  category:    { type: String, required: true },
  location:    { type: String, required: true },
  desc:        { type: String, default: "" },
  date:        { type: String, required: true },
  email:       { type: String, default: "" },
  img:         { type: String, default: null },
  verified:    { type: Boolean, default: false },
  postedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  postedByName:{ type: String },
  postedByEmail:{ type: String },
  claims:      [claimSchema],
}, { timestamps: true });

module.exports = mongoose.model("Item", itemSchema);

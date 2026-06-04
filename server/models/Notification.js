const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:   { type: String, enum: ["match", "verify", "chat"], required: true },
  title:  { type: String, required: true },
  desc:   { type: String, required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", default: null },
  read:   { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);

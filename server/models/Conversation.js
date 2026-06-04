const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  from:   { type: String, enum: ["me", "them"], required: true },
  text:   { type: String, required: true },
  time:   { type: String },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  item:         { type: String, required: true }, // item name
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  messages:     [messageSchema],
  lastMsg:      { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);

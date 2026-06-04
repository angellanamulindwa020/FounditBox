require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const email = process.argv[2];
const newPassword = process.argv[3];
if (!email || !newPassword) { console.log("Usage: node resetPassword.js email newpassword"); process.exit(1); }

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hashed = await bcrypt.hash(newPassword, 10);
  const user = await User.findOneAndUpdate({ email }, { password: hashed }, { new: true });
  if (!user) console.log("User not found:", email);
  else console.log(`✓ Password reset for ${user.email}`);
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });

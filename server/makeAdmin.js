require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const email = process.argv[2];
if (!email) { console.log("Usage: node makeAdmin.js your@email.com"); process.exit(1); }

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOneAndUpdate({ email }, { role: "admin", verified: true }, { new: true });
  if (!user) console.log("User not found:", email);
  else console.log(`✓ ${user.first} ${user.last} is now an admin`);
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });

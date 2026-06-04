require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find().select("first last email role verified");
  users.forEach(u => console.log(`${u.email} | role: ${u.role} | verified: ${u.verified}`));
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });

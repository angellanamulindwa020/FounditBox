require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const User = require("./models/User");
const Item = require("./models/Item");
const Conversation = require("./models/Conversation");
const Notification = require("./models/Notification");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log("Connected, importing...");
  const data = JSON.parse(fs.readFileSync("./backup.json"));
  await User.deleteMany({});
  await Item.deleteMany({});
  await Conversation.deleteMany({});
  await Notification.deleteMany({});
  if (data.users.length) await User.insertMany(data.users);
  if (data.items.length) await Item.insertMany(data.items);
  if (data.conversations.length) await Conversation.insertMany(data.conversations);
  if (data.notifications.length) await Notification.insertMany(data.notifications);
  console.log(`✓ Imported: ${data.users.length} users, ${data.items.length} items, ${data.conversations.length} conversations, ${data.notifications.length} notifications`);
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });

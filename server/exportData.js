require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const User = require("./models/User");
const Item = require("./models/Item");
const Conversation = require("./models/Conversation");
const Notification = require("./models/Notification");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log("Connected to Atlas, exporting...");
  const data = {
    users: await User.find().lean(),
    items: await Item.find().lean(),
    conversations: await Conversation.find().lean(),
    notifications: await Notification.find().lean(),
  };
  fs.writeFileSync("./backup.json", JSON.stringify(data, null, 2));
  console.log(`✓ Exported: ${data.users.length} users, ${data.items.length} items, ${data.conversations.length} conversations, ${data.notifications.length} notifications`);
  console.log("Saved to server/backup.json");
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });

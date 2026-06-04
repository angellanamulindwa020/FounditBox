require("dotenv").config();
const mongoose = require("mongoose");
const Item = require("./models/Item");
const Notification = require("./models/Notification");
const Conversation = require("./models/Conversation");

mongoose.connect(process.env.MONGO_URI, { family: 4 }).then(async () => {
  await Item.deleteMany({});
  await Notification.deleteMany({});
  await Conversation.deleteMany({});
  console.log("All items, notifications and conversations cleared.");
  process.exit(0);
}).catch(err => { console.error(err.message); process.exit(1); });

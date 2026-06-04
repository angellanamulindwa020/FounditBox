require("dotenv").config();
const mongoose = require("mongoose");

const ATLAS_URI = "mongodb://angellanamulindwa020_db_user:N%40mu123@ac-zi3sija-shard-00-00.a33sinq.mongodb.net:27017,ac-zi3sija-shard-00-01.a33sinq.mongodb.net:27017,ac-zi3sija-shard-00-02.a33sinq.mongodb.net:27017/foundit?ssl=true&replicaSet=atlas-12jhur-shard-0&authSource=admin&retryWrites=true";
const LOCAL_URI = "mongodb://localhost:27017/founditbox";

async function migrate() {
  console.log("Connecting to Atlas...");
  const atlas = await mongoose.createConnection(ATLAS_URI, { serverSelectionTimeoutMS: 30000, family: 4 }).asPromise();
  console.log("Connected to Atlas");

  console.log("Connecting to Local MongoDB...");
  const local = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log("Connected to Local MongoDB");

  const collections = ["users", "items", "conversations", "notifications"];

  for (const name of collections) {
    console.log(`Migrating ${name}...`);
    const srcCol = atlas.collection(name);
    const dstCol = local.collection(name);
    const docs = await srcCol.find({}).toArray();
    console.log(`${name}: fetched ${docs.length} documents from Atlas`);
    if (docs.length === 0) { console.log(`${name}: skipping`); continue; }
    await dstCol.deleteMany({});
    await dstCol.insertMany(docs);
    console.log(`${name}: done`);
  }

  await atlas.close();
  await local.close();
  console.log("\nMigration complete! All data copied to local MongoDB.");
}

migrate().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });

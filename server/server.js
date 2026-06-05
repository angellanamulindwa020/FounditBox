const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/items", require("./routes/items"));
app.use("/api/conversations", require("./routes/conversations"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/subscription", require("./routes/subscription"));

// Serve frontend static files
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "..", "index.html")));
app.get("/style.css", (_req, res) => res.sendFile(path.join(__dirname, "..", "style.css")));
app.get("/script.js", (_req, res) => res.sendFile(path.join(__dirname, "..", "script.js")));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ message: err.message });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, "0.0.0.0", () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error("MongoDB connection error:", err.message));

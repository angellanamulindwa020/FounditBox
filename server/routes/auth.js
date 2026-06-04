const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const strongPassword = p => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(p);

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { first, last, email, password } = req.body;
    if (!first || !last || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (!strongPassword(password))
      return res.status(400).json({ message: "Password must be 8+ characters, include a capital letter and a number" });
    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ first, last, email, password: hashed, verified: false });
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me — get current user from token
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitize(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/auth/profile — update profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { first, last, phone, bio, location, avatar, password } = req.body;
    const update = { first, last, phone, bio, location, avatar };
    if (password) update.password = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select("-password");
    res.json(sanitize(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "No account with that email" });
    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();
    // In production you'd email this. For now return it directly.
    res.json({ message: "Reset token generated", resetToken: token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!strongPassword(password))
      return res.status(400).json({ message: "Password must be 8+ characters, include a capital letter and a number" });
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });
    user.password = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function sanitize(user) {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
}

module.exports = router;

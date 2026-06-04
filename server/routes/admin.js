const router = require("express").Router();
const User = require("../models/User");
const Item = require("../models/Item");
const Notification = require("../models/Notification");
const adminAuth = require("../middleware/adminAuth");

// GET /api/admin/stats — system overview
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const [totalUsers, unverifiedUsers, verifiedUsers, totalItems, pendingItems] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      User.countDocuments({ role: { $ne: "admin" }, verified: false }),
      User.countDocuments({ role: { $ne: "admin" }, verified: true }),
      Item.countDocuments(),
      Item.countDocuments({ verified: false }),
    ]);
    res.json({ totalUsers, unverifiedUsers, verifiedUsers, totalItems, pendingItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/broadcast — send notification to all users
router.post("/broadcast", adminAuth, async (req, res) => {
  try {
    const { title, desc } = req.body;
    if (!title || !desc) return res.status(400).json({ message: "Title and message required" });
    const users = await User.find({ role: "user" }).select("_id");
    await Notification.insertMany(users.map(u => ({
      user: u._id, type: "verify", title, desc, read: false
    })));
    res.json({ success: true, sent: users.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/items — all items including unverified
router.get("/items", adminAuth, async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 }).select("-img");    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/verify — approve/reject user
router.patch("/users/:id/verify", adminAuth, async (req, res) => {
  try {
    const { verified } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { verified }, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/items/:id/verify — approve/reject item
router.patch("/items/:id/verify", adminAuth, async (req, res) => {
  try {
    const { verified } = req.body;
    const item = await Item.findByIdAndUpdate(req.params.id, { verified }, { new: true });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/users/:id — delete a user
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Item.deleteMany({ postedBy: req.params.id });
    await Notification.deleteMany({ user: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/items/:id — delete any item
router.delete("/items/:id", adminAuth, async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    await Notification.deleteMany({ itemId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/role — promote/demote user
router.patch("/users/:id/role", adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ message: "Invalid role" });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/subscriptions — users with active subscriptions
router.get("/subscriptions", adminAuth, async (req, res) => {
  try {
    const users = await User.find({ "subscription.status": "active" })
      .select("first last email subscription")
      .sort({ "subscription.startDate": -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

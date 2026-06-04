const router = require("express").Router();
const Item = require("../models/Item");
const Notification = require("../models/Notification");
const User = require("../models/User");
const auth = require("../middleware/auth");

// GET /api/items — all items (global, all users see them)
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role");
    const filter = user.role === "admin" ? {} : { verified: true };
    const items = await Item.find(filter).sort({ createdAt: -1 }).select("-img -claims");
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/items/claims-count — total claims for current user's items
router.get("/claims-count", auth, async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.user.id }).select("claims");
    const total = items.reduce((sum, i) => sum + (i.claims?.length || 0), 0);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/items/:id — single item with image
router.get("/:id", auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/items — report a new item
router.post("/", auth, async (req, res) => {
  try {
    const { name, status, category, location, desc, date, email, img } = req.body;
    const poster = await User.findById(req.user.id).select("first last email");

    const item = await Item.create({
      name, status, category, location, desc, date,
      email: email || poster.email,
      img: img || null,
      verified: true, // auto-verified
      postedBy: req.user.id,
      postedByName: `${poster.first} ${poster.last}`,
      postedByEmail: poster.email,
    });

    res.status(201).json(item);

    // Run notifications in background (don't block response)
    (async () => {
      try {
        await Notification.create({ user: req.user.id, type: "verify", title: "Item Reported", desc: `Your "${name}" has been posted and verified.`, itemId: item._id });
        const oppositeStatus = status === "Lost" ? "Found" : "Lost";
        const matches = await Item.find({ status: oppositeStatus, category, postedBy: { $ne: req.user.id } });
        for (const match of matches) {
          await Notification.create({ user: req.user.id, type: "match", title: "Potential Match Found!", desc: `Your ${status.toLowerCase()} "${name}" may match "${match.name}" by ${match.postedByName}.`, itemId: match._id });
          await Notification.create({ user: match.postedBy, type: "match", title: "Potential Match Found!", desc: `Your ${oppositeStatus.toLowerCase()} "${match.name}" may match "${name}" posted by ${poster.first} ${poster.last}.`, itemId: item._id });
        }
      } catch (e) { console.error("Notification error:", e.message); }
    })();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/items/:id/status — mark returned or received
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.postedBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Only the poster can update this item" });
    item.status = req.body.status || "Returned";
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/items/:id/claims — submit a claim (verified users only)
router.post("/:id/claims", auth, async (req, res) => {
  try {
    const claimer = await User.findById(req.user.id).select("first last verified");
    if (!claimer.verified)
      return res.status(403).json({ message: "Only verified users can claim items" });
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.postedBy.toString() === req.user.id)
      return res.status(400).json({ message: "You cannot claim your own item" });
    const already = item.claims.find(c => c.claimedBy.toString() === req.user.id);
    if (already) return res.status(400).json({ message: "You have already claimed this item" });
    item.claims.push({
      claimedBy: req.user.id,
      claimedByName: `${claimer.first} ${claimer.last}`,
      message: req.body.message || "",
    });
    await item.save();
    // Notify item owner
    await Notification.create({
      user: item.postedBy, type: "match",
      title: "New Claim on Your Item",
      desc: `${claimer.first} ${claimer.last} has claimed your "${item.name}".`,
      itemId: item._id,
    });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/items/:id/claims/:claimId — approve or reject a claim (item owner or admin)
router.patch("/:id/claims/:claimId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role");
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.postedBy.toString() !== req.user.id && user.role !== "admin")
      return res.status(403).json({ message: "Not authorized to update this claim" });
    const claim = item.claims.id(req.params.claimId);
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    claim.claimStatus = req.body.claimStatus;
    await item.save();
    // Notify claimer
    await Notification.create({
      user: claim.claimedBy, type: "verify",
      title: `Claim ${req.body.claimStatus}`,
      desc: `Your claim on "${item.name}" has been ${req.body.claimStatus.toLowerCase()}.`,
      itemId: item._id,
    });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/items/claims-count — moved above, removing duplicate
module.exports = router;

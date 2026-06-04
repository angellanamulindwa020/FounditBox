const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

const PLANS = {
  monthly: { price: 12, currency: "USD", days: 30 },
  yearly:  { price: 140, currency: "USD", days: 365 },
};

// POST /api/subscription/subscribe
router.post("/subscribe", auth, async (req, res) => {
  try {
    const { plan, method, cardNumber, cardName, expiry, cvv, phone } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ message: "Invalid plan" });
    if (!method) return res.status(400).json({ message: "Payment method required" });

    // Simulate payment validation
    if (["visa", "mastercard"].includes(method)) {
      if (!cardNumber || !cardName || !expiry || !cvv)
        return res.status(400).json({ message: "Card details required" });
      if (cardNumber.replace(/\s/g, "").length < 16)
        return res.status(400).json({ message: "Invalid card number" });
    }
    if (["mtn", "airtel"].includes(method)) {
      if (!phone) return res.status(400).json({ message: "Phone number required" });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + PLANS[plan].days);

    const user = await User.findByIdAndUpdate(req.user.id, {
      subscription: { plan, status: "active", startDate, endDate, method }
    }, { new: true }).select("-password");

    res.json({ message: "Subscription activated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/subscription/status
router.get("/status", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("subscription");
    const sub = user.subscription;
    // Auto-expire
    if (sub.status === "active" && sub.endDate && new Date() > new Date(sub.endDate)) {
      await User.findByIdAndUpdate(req.user.id, { "subscription.status": "expired" });
      sub.status = "expired";
    }
    res.json(sub);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

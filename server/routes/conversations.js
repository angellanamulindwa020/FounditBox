const router = require("express").Router();
const Conversation = require("../models/Conversation");
const Item = require("../models/Item");
const auth = require("../middleware/auth");

// GET /api/conversations — get current user's conversations
router.get("/", auth, async (req, res) => {
  try {
    const convos = await Conversation.find({ participants: req.user.id })
      .populate("participants", "first last avatar")
      .sort({ updatedAt: -1 });
    res.json(convos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/conversations — start or get a conversation about an item
router.post("/", auth, async (req, res) => {
  try {
    const { itemId } = req.body;
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    // Block owner from chatting with themselves
    if (item.postedBy.toString() === req.user.id)
      return res.status(403).json({ message: "You cannot chat with yourself" });

    // Check if conversation already exists
    let convo = await Conversation.findOne({ participants: { $all: [req.user.id, item.postedBy] }, itemId });
    if (!convo) {
      convo = await Conversation.create({
        participants: [req.user.id, item.postedBy],
        item: item.name,
        itemId: item._id,
        messages: [],
        lastMsg: "",
      });
    }
    await convo.populate("participants", "first last avatar");
    res.json(convo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/conversations/:id/messages — send a message
router.post("/:id/messages", auth, async (req, res) => {
  try {
    const { text } = req.body;
    const convo = await Conversation.findOne({ _id: req.params.id, participants: req.user.id });
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    convo.messages.push({ from: req.user.id, text, time });
    convo.lastMsg = text;
    await convo.save();
    await convo.populate("participants", "first last avatar");
    res.json(convo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

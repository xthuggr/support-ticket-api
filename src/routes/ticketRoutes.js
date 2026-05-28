const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, ticketController.createTicket);
router.get("/", authMiddleware, ticketController.getTickets);
router.patch("/:id/assign", authMiddleware, ticketController.assignTicket);
router.post("/:id/comments", authMiddleware, ticketController.createComment);
router.get("/:id/comments", authMiddleware, ticketController.getComments);
router.get("/:id", authMiddleware, ticketController.getTicketById);
router.patch("/:id", authMiddleware, ticketController.updateTicketStatus);

module.exports = router;

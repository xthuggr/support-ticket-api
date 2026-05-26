const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

router.post("/", userController.createUser);
router.get("/", authMiddleware, requireRole("admin"), userController.getUsers);
router.get("/:id", userController.getUserById);
router.patch("/:id", userController.updateUser);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  userController.deleteUser,
);

module.exports = router;

const express = require("express");
const router = express.Router();
const dbController = require("../controllers/dbController");

router.get("/", dbController.dbCurrentTime);

module.exports = router;

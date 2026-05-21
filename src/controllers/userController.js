const bcrypt = require("bcrypt");
const pool = require("../db/pool");

exports.createUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at",
      [username, email, passwordHash, "customer"],
    );
    const createdUser = result.rows[0];
    res.status(201).json({
      status: "success",
      user: createdUser,
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        status: "error",
        message: "Username or email already exists",
      });
    }
    console.error("Error inside newUser controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

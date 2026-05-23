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
    console.error("Error inside createUser controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC",
    );
    res.status(200).json({
      status: "ok",
      count: result.rowCount,
      users: result.rows,
    });
  } catch (err) {
    console.error("Error inside getUsers controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await pool.query(
      "SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = $1",
      [userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "ok",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error inside getUserById controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }
    const result = await pool.query(
      "UPDATE users SET username = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, username, email, role, updated_at",
      [username, email, userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        status: "error",
        message: "Username or email is already taken by another user",
      });
    }
    console.error("Error inside updateUser controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await pool.query(
      "UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, username, email, role, is_active, updated_at",
      [userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "ok",
      message: "user deactivated",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error inside deleteUser controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

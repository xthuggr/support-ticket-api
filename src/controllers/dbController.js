const pool = require("../db/pool"); //already connected the database in another file with .env

exports.dbCurrentTime = async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    const currentTime = result.rows[0].now;
    res.status(200).json({
      status: "success",
      database_time: currentTime,
    });
  } catch (err) {
    console.error("Error inside dbCurrentTime controller:", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected database error occurred",
    });
  }
};

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or missing Bearer token",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: Invalid or expired token",
      });
    }
    console.error(
      "An unexpected error occurred in authMiddleware Middleware",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

module.exports = authMiddleware;

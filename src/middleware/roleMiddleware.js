const requireRole = (role) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      console.log(req.user.role);

      if (req.user.role !== role) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: insufficient permissions",
        });
      }

      next();
    } catch (err) {
      console.error("An unexpected error requiredRole Middleware", err.message);
      res.status(500).json({
        status: "error",
        message: "An unexpected server error occurred",
      });
    }
  };
};

module.exports = requireRole;

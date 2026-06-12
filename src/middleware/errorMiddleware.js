const errorMiddleware = async (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    status: "error",
    message:
      statusCode === 500 ? "An unexpected server error ocurred" : err.message,
  });
};

module.exports = errorMiddleware;

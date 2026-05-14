exports.healthCheck = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "support-ticket-api",
  });
};

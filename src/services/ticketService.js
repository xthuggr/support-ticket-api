const pool = require("../db/pool");

exports.getTickets = async ({
  userId,
  userRole,
  status,
  priority,
  page,
  limit,
}) => {
  const isStaff = userRole === "support" || userRole === "admin";
  const isCustomer = userRole === "customer";
  if (!isStaff && !isCustomer) {
    throw new Error("FORBIDDEN");
  }
  const allowedStatus = [
    "open",
    "in_progress",
    "waiting_customer",
    "resolved",
    "closed",
  ];
  const isStatusValid = allowedStatus.includes(status);
  const allowedPriorities = ["low", "medium", "high"];
  const isValidPriority = allowedPriorities.includes(priority);
  if (status && !isStatusValid) {
    throw new Error("INVALID_FILTER");
  }
  if (priority && !isValidPriority) {
    throw new Error("INVALID_FILTER");
  }

  if (!page || page === "") {
    page = 1;
  }
  const pageNumber = Number(page);
  if (pageNumber < 1 || Number.isNaN(pageNumber)) {
    throw new Error("INVALID_PAGINATION");
  }

  if (!limit || limit === "") {
    limit = 10;
  }
  const limitNumber = Number(limit);
  if (limitNumber < 1 || limitNumber > 50 || Number.isNaN(limitNumber)) {
    throw new Error("INVALID_PAGINATION");
  }

  const offset = (pageNumber - 1) * limitNumber;

  let result;
  if (isStaff) {
    if (isStatusValid && isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE status = $1 AND priority = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
        [status, priority, limitNumber, offset],
      );
    } else if (isStatusValid) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [status, limitNumber, offset],
      );
    } else if (isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE priority = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [priority, limitNumber, offset],
      );
    } else {
      result = await pool.query(
        "SELECT * FROM tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [limitNumber, offset],
      );
    }
  }
  if (isCustomer) {
    if (isStatusValid && isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 AND status = $2 AND priority = $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5",
        [userId, status, priority, limitNumber, offset],
      );
    } else if (isStatusValid) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
        [userId, status, limitNumber, offset],
      );
    } else if (isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 AND priority = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
        [userId, priority, limitNumber, offset],
      );
    } else {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [userId, limitNumber, offset],
      );
    }
  }
  return {
    tickets: result.rows,
    page: pageNumber,
    limit: limitNumber,
    count: result.rowCount,
  };
};

exports.getTicketById = async ({ ticketId, userId, userRole }) => {
  const result = await pool.query("SELECT * FROM tickets WHERE id = $1", [
    ticketId,
  ]);

  if (result.rows.length === 0) {
    throw new Error("TICKET_NOT_FOUND");
  }

  const ticket = result.rows[0];

  const isStaff = userRole === "support" || userRole === "admin";
  const isTicketOwner = userRole === "customer" && userId === ticket.created_by;

  if (!isStaff && !isTicketOwner) {
    throw new Error("FORBIDDEN");
  }

  return ticket;
};

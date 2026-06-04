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

  const pageNumber = Number(page);
  const limitNumber = Number(limit) || 10;

  console.log(pageNumber);
  console.log(pageNumber < 1);
  if (pageNumber < 1) {
    throw new Error("INVALID_NUMBER");
    console.log("hit");
  }
  // if (!limitNumber >= 1 || !limitNumber <= 50) {
  //   throw new Error("INVALID_NUMBER");
  // }

  const offset = (pageNumber - 1) * limitNumber;

  if (isStaff) {
    let result;
    if (isStatusValid && isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE status = $1 AND priority = $2 ORDER BY created_at DESC",
        [status, priority],
      );
    } else if (isStatusValid) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE status = $1 ORDER BY created_at DESC",
        [status],
      );
    } else if (isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE priority = $1 ORDER BY created_at DESC",
        [priority],
      );
    } else {
      result = await pool.query(
        "SELECT * FROM tickets ORDER BY created_at DESC",
      );
    }
    return result.rows;
  }
  if (isCustomer) {
    let result;
    if (isStatusValid && isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 AND status = $2 AND priority = $3 ORDER BY created_at DESC",
        [userId, status, priority],
      );
    } else if (isStatusValid) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 AND status = $2 ORDER BY created_at DESC",
        [userId, status],
      );
    } else if (isValidPriority) {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 AND priority = $2 ORDER BY created_at DESC",
        [userId, priority],
      );
    } else {
      result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 ORDER BY created_at DESC",
        [userId],
      );
    }
    return result.rows;
  }
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

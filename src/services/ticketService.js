const pool = require("../db/pool");
const {
  ALLOWED_STATUSES,
  ALLOWED_PRIORITIES,
} = require("../utils/ticketConstants");

const AppError = require("../utils/AppError");

exports.getTickets = async ({
  userId,
  userRole,
  status,
  priority,
  search,
  page,
  limit,
}) => {
  const isStaff = userRole === "support" || userRole === "admin";
  const isCustomer = userRole === "customer";
  if (!isStaff && !isCustomer) {
    throw new AppError("Forbidden", 403);
  }

  const isStatusValid = ALLOWED_STATUSES.includes(status);
  const isValidPriority = ALLOWED_PRIORITIES.includes(priority);

  if (status && !isStatusValid) {
    throw new AppError("Invalid filter", 400);
  }
  if (priority && !isValidPriority) {
    throw new AppError("Invalid filter", 400);
  }
  if (!page || page === "") {
    page = 1;
  }
  const pageNumber = Number(page);
  if (pageNumber < 1 || Number.isNaN(pageNumber)) {
    throw new AppError("Invalid pagination", 400);
  }
  if (!limit || limit === "") {
    limit = 10;
  }
  const limitNumber = Number(limit);
  if (limitNumber < 1 || limitNumber > 50 || Number.isNaN(limitNumber)) {
    throw new AppError("Invalid pagination", 400);
  }
  const offset = (pageNumber - 1) * limitNumber;

  const searchTerm = search?.trim();

  let query = "SELECT * FROM tickets";
  let countQuery = "SELECT COUNT(*) FROM tickets";
  const conditions = [];
  const values = [];

  if (isCustomer) {
    values.push(userId);
    conditions.push(`created_by = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (priority) {
    values.push(priority);
    conditions.push(`priority = $${values.length}`);
  }

  if (searchTerm) {
    values.push(`%${searchTerm}%`);
    conditions.push(
      `(title ILIKE $${values.length} OR description ILIKE $${values.length})`,
    );
  }

  if (conditions.length > 0) {
    const whereClause = " WHERE " + conditions.join(" AND ");
    query += whereClause;
    countQuery += whereClause;
  }

  const countResult = await pool.query(countQuery, values);

  const [{ count }] = countResult.rows;
  const totalTickets = Number(count);
  const totalPages = Math.ceil(totalTickets / limitNumber);

  query += ` ORDER BY created_at DESC`;

  values.push(limitNumber);
  query += ` LIMIT $${values.length}`;

  values.push(offset);
  query += ` OFFSET $${values.length}`;

  const result = await pool.query(query, values);

  return {
    tickets: result.rows,
    page: pageNumber,
    limit: limitNumber,
    count: result.rowCount,
    total: totalTickets,
    totalPages: totalPages,
  };
};

exports.getTicketById = async ({ ticketId, userId, userRole }) => {
  const result = await pool.query("SELECT * FROM tickets WHERE id = $1", [
    ticketId,
  ]);

  if (result.rows.length === 0) {
    throw new AppError("Ticket not found", 404);
  }

  const ticket = result.rows[0];

  const isStaff = userRole === "support" || userRole === "admin";
  const isTicketOwner = userRole === "customer" && userId === ticket.created_by;

  if (!isStaff && !isTicketOwner) {
    throw new AppError("Forbidden", 403);
  }

  return ticket;
};

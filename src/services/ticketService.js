const pool = require("../db/pool");
const {
  ALLOWED_STATUSES,
  ALLOWED_PRIORITIES,
} = require("../utils/ticketConstants");
const AppError = require("../utils/AppError");

const getAuthorizedTicket = async ({ ticketId, userId, userRole }) => {
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

exports.createTicket = async ({ title, description, priority, userId }) => {
  const ticketPriority = priority || "medium";
  if (!title || !description) {
    throw new AppError("All fields are required", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticketResult = await client.query(
      "INSERT INTO tickets (title, description, priority, created_by) VALUES ($1, $2, $3, $4) RETURNING id, title, description, status, priority, created_by, assigned_to, created_at",
      [title, description, ticketPriority, userId],
    );
    const ticket = ticketResult.rows[0];
    const ticketId = ticket.id;
    const action = "ticket_created";
    const details = "Ticket was created";
    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1, $2, $3, $4)",
      [ticketId, userId, action, details],
    );
    await client.query("COMMIT");
    return ticket;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.statusCode) {
      throw err;
    }
    console.error(
      "An unexpected error occurred in createTicket Service",
      err.message,
    );
    throw new AppError("An unexpected server error occurred", 500);
  } finally {
    client.release();
  }
};

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
  const ticket = await getAuthorizedTicket({
    ticketId,
    userId,
    userRole,
  });
  return ticket;
};

exports.updateTicketStatus = async ({ ticketId, status, userRole, userId }) => {
  if (userRole !== "support" && userRole !== "admin") {
    throw new AppError("Forbidden", 403);
  }
  const isStatusValid = ALLOWED_STATUSES.includes(status);
  if (!isStatusValid) {
    throw new AppError("Invalid status", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticketQuery = await client.query(
      "SELECT * FROM tickets WHERE id = $1",
      [ticketId],
    );
    if (ticketQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new AppError("Ticket not found", 404);
    }
    const getTicket = ticketQuery.rows[0];
    const oldStatus = getTicket.status;
    const ticketUpdated = await client.query(
      "UPDATE tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, title, description, priority, status, created_by, assigned_to, updated_at",
      [status, ticketId],
    );
    const newTicket = ticketUpdated.rows[0];
    const newStatus = newTicket.status;
    const action = "ticket_updated";
    const details = `Status changed from ${oldStatus} to ${newStatus}`;
    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1, $2, $3, $4)",
      [ticketId, userId, action, details],
    );
    await client.query("COMMIT");
    return ticketUpdated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.statusCode) {
      throw err;
    }
    console.error(
      "An unexpected error occurred in updateTicketStatus Service",
      err.message,
    );
    throw new AppError("An unexpected server error occurred", 500);
  } finally {
    client.release();
  }
};

exports.assignTicket = async ({ userRole, assigned_to, ticketId, userId }) => {
  if (userRole !== "support" && userRole !== "admin") {
    throw new AppError("Forbidden", 403);
  }
  if (!assigned_to) {
    throw new AppError("User ID is required to assign ticket", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userQuery = await client.query(
      "SELECT id, role FROM users WHERE id = $1 AND is_active = true",
      [assigned_to],
    );
    const assignedUser = userQuery.rows[0];
    if (!assignedUser) {
      await client.query("ROLLBACK");
      throw new AppError("User not found", 404);
    }
    if (assignedUser.role !== "support" && assignedUser.role !== "admin") {
      throw new AppError("Assigned user must be authorized", 403);
    }
    const ticketQuery = await client.query(
      "SELECT assigned_to, id FROM tickets WHERE id = $1",
      [ticketId],
    );
    if (ticketQuery.rows.length === 0) {
      throw new AppError("Ticket not found", 404);
    }
    const getTicket = ticketQuery.rows[0];
    const oldAssignedUser = getTicket.assigned_to;
    const updateTicket = await client.query(
      "UPDATE tickets SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, title, status, priority, created_by, assigned_to, updated_at",
      [assignedUser.id, ticketId],
    );
    const updatedTicket = updateTicket.rows[0];
    const newAssignedUser = updatedTicket.assigned_to;
    const action = "ticket_assigned";
    const details = `Ticket assigned from ${oldAssignedUser} to ${newAssignedUser}`;
    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1, $2, $3, $4)",
      [ticketId, userId, action, details],
    );
    await client.query("COMMIT");
    return updatedTicket;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.statusCode) {
      throw err;
    }
    console.error(
      "An unexpected error occurred in assignTicket Service",
      err.message,
    );
    throw new AppError("An unexpected server error occurred", 500);
  } finally {
    client.release();
  }
};

exports.createComment = async ({ comment, ticketId, userId, userRole }) => {
  if (!comment) {
    throw new AppError("Comment is required", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await getAuthorizedTicket({
      ticketId,
      userId,
      userRole,
    });
    const result = await client.query(
      "INSERT INTO ticket_comments (ticket_id, author_id, comment) VALUES ($1, $2, $3) RETURNING id, ticket_id, author_id, comment, created_at",
      [ticketId, userId, comment],
    );
    const commentCreated = result.rows[0];
    const action = "comment_added";
    const details = "Comment added to ticket";
    await client.query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1, $2, $3, $4)",
      [ticketId, userId, action, details],
    );
    await client.query("COMMIT");
    return commentCreated;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.statusCode) {
      throw err;
    }
    console.error(
      "An unexpected error occurred in createComment Service",
      err.message,
    );
    throw new AppError("An unexpected server error occurred", 500);
  } finally {
    client.release();
  }
};

exports.getComments = async ({ userRole, ticketId, userId }) => {
  await getAuthorizedTicket({
    ticketId,
    userId,
    userRole,
  });
  const result = await pool.query(
    "SELECT id, ticket_id, author_id, comment, created_at FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC",
    [ticketId],
  );
  return result.rows;
};

exports.getTicketActivity = async ({ userRole, ticketId, userId }) => {
  await getAuthorizedTicket({
    ticketId,
    userId,
    userRole,
  });
  const activityQuery = await pool.query(
    "SELECT id, ticket_id, actor_id, action, details, created_at FROM ticket_activity WHERE ticket_id = $1 ORDER BY created_at ASC",
    [ticketId],
  );
  return activityQuery.rows;
};

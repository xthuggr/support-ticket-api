const pool = require("../db/pool");
const ticketService = require("../services/ticketService");

exports.createTicket = async (req, res) => {
  const { title, description, priority } = req.body;
  const ticketPriority = priority || "medium";
  const userId = req.user.id;
  if (!title || !description) {
    return res.status(400).json({
      status: "error",
      message: "All fields are required",
    });
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
    return res.status(201).json({
      status: "success",
      ticket: ticket,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error inside createTicket controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  } finally {
    client.release();
  }
};

exports.getTickets = async (req, res) => {
  try {
    const tickets = await ticketService.getTickets({
      userId: req.user.id,
      userRole: req.user.role,
      status: req.query.status,
      priority: req.query.priority,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({
      status: "success",
      count: tickets.length,
      tickets,
    });
  } catch (err) {
    if (err.message === "FORBIDDEN") {
      return res.status(403).json({
        status: "error",
        message: "Forbidden",
      });
    }
    if (err.message === "INVALID_FILTER") {
      return res.status(400).json({
        status: "error",
        message: "Invalid filter",
      });
    }
    if (err.message === "INVALID_NUMBER") {
      return res.status(400).json({
        status: "error",
        message: "Invalid number",
      });
    }
    console.error("Error inside getTickets controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await ticketService.getTicketById({
      ticketId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return res.status(200).json({
      status: "success",
      ticket,
    });
  } catch (err) {
    if (err.message === "FORBIDDEN") {
      return res.status(403).json({
        status: "error",
        message: "Forbidden",
      });
    }
    if (err.message === "TICKET_NOT_FOUND") {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    console.error("Error inside getTicketById controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.updateTicketStatus = async (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;
  const userRole = req.user.role;
  const userId = req.user.id;
  const allowedStatus = [
    "open",
    "in_progress",
    "waiting_customer",
    "resolved",
    "closed",
  ];
  if (userRole !== "support" && userRole !== "admin") {
    return res.status(403).json({
      status: "error",
      message: "Forbidden",
    });
  }
  const isStatusValid = allowedStatus.includes(status);
  if (!isStatusValid) {
    return res.status(400).json({
      status: "error",
      message: "Invalid status",
    });
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
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
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
    return res.status(200).json({
      status: "success",
      message: "Ticket updated successfully",
      ticket: ticketUpdated.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(
      "An unexpected error occurred in updateTicketStatus Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  } finally {
    client.release();
  }
};

exports.assignTicket = async (req, res) => {
  const userRole = req.user.role;
  const { assigned_to } = req.body;
  const ticketId = req.params.id;
  const userId = req.user.id;
  if (userRole !== "support" && userRole !== "admin") {
    return res.status(403).json({
      status: "error",
      message: "Forbidden",
    });
  }
  if (!assigned_to) {
    return res.status(400).json({
      status: "error",
      message: "User ID is required to assign ticket",
    });
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
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    if (assignedUser.role !== "support" && assignedUser.role !== "admin") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        status: "error",
        message: "Assigned user must be authorized",
      });
    }
    const ticketQuery = await client.query(
      "SELECT assigned_to, id FROM tickets WHERE id = $1",
      [ticketId],
    );
    if (ticketQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
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

    return res.status(200).json({
      status: "success",
      message: "Ticket updated successfully",
      ticket: updatedTicket,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(
      "An unexpected error occurred in assignTicket Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  } finally {
    client.release();
  }
};

exports.createComment = async (req, res) => {
  const { comment } = req.body;
  const ticketId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  if (!comment) {
    return res.status(400).json({
      status: "error",
      message: "Comment is required",
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticketQuery = await client.query(
      "SELECT id, created_by FROM tickets WHERE id = $1",
      [ticketId],
    );
    const ticket = ticketQuery.rows[0];
    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    const isStaff = userRole === "support" || userRole === "admin";
    const isTicketOwner =
      userRole === "customer" && userId === ticket.created_by;
    if (!isStaff && !isTicketOwner) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        status: "error",
        message: "You are not allowed to comment",
      });
    }
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
    res.status(201).json({
      status: "success",
      message: "Comment created successfully",
      comment: commentCreated,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(
      "An unexpected error occurred in createComment Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  } finally {
    client.release();
  }
};

exports.getComments = async (req, res) => {
  try {
    const userRole = req.user.role;
    const ticketId = req.params.id;
    const userId = req.user.id;

    if (!userRole) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden",
      });
    }

    const ticketQuery = await pool.query(
      "SELECT id, created_by FROM tickets WHERE id = $1",
      [ticketId],
    );

    if (ticketQuery.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    const ticket = ticketQuery.rows[0];
    const isStaff = userRole === "support" || userRole === "admin";
    const isTicketOwner =
      userRole === "customer" && userId === ticket.created_by;

    if (!isStaff && !isTicketOwner) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized",
      });
    }

    const result = await pool.query(
      "SELECT id, ticket_id, author_id, comment, created_at FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC",
      [ticketId],
    );

    res.status(200).json({
      status: "success",
      comments: result.rows,
    });
  } catch (err) {
    console.error(
      "An unexpected error occurred in getComments Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.getTicketActivity = async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  if (!userRole) {
    return res.status(403).json({
      status: "error",
      message: "Forbidden",
    });
  }
  try {
    const ticketQuery = await pool.query(
      "SELECT id, created_by FROM tickets WHERE id = $1",
      [ticketId],
    );
    if (ticketQuery.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    const ticket = ticketQuery.rows[0];
    const isStaff = userRole === "admin" || userRole === "support";
    const isTicketOwner =
      userRole === "customer" && userId === ticket.created_by;

    if (!isStaff && !isTicketOwner) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized",
      });
    }
    const activityQuery = await pool.query(
      "SELECT id, ticket_id, actor_id, action, details, created_at FROM ticket_activity WHERE ticket_id = $1 ORDER BY created_at ASC",
      [ticketId],
    );
    return res.status(200).json({
      status: "success",
      activity: activityQuery.rows,
    });
  } catch (err) {
    console.error(
      "An unexpected error occurred in getTicketActivity Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

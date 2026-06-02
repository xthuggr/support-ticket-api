const pool = require("../db/pool");

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
    const userId = req.user.id;
    const userRole = req.user.role;
    const status = req.query.status;
    const priority = req.query.priority;

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

    const isStaff = userRole === "support" || userRole === "admin";
    const isCustomer = userRole === "customer";

    if (status && !isStatusValid) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request",
      });
    }
    if (priority && !isValidPriority) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request",
      });
    }
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
      return res.status(200).json({
        status: "success",
        count: result.rowCount,
        tickets: result.rows,
      });
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
      return res.status(200).json({
        status: "success",
        tickets: result.rows,
      });
    }
    return res.status(403).json({
      status: "error",
      message: "Forbidden",
    });
  } catch (err) {
    console.error("Error inside getTickets controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const result = await pool.query("SELECT * FROM tickets WHERE id = $1", [
      ticketId,
    ]);
    const ticket = result.rows[0];
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    if (userRole === "support" || userRole === "admin") {
      return res.status(200).json({
        status: "success",
        ticket: ticket,
      });
    }
    if (userRole === "customer" && ticket.created_by === userId) {
      return res.status(200).json({
        status: "success",
        ticket: ticket,
      });
    }
    return res.status(403).json({
      status: "error",
      message: "Forbidden",
    });
  } catch (err) {
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

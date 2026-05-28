const pool = require("../db/pool");

exports.createTicket = async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const ticketPriority = priority || "medium";
    const userId = req.user.id;
    if (!title || !description) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }
    const result = await pool.query(
      "INSERT INTO tickets (title, description, priority, created_by) VALUES ($1, $2, $3, $4) RETURNING id, title, description, status, priority, created_by, assigned_to, created_at",
      [title, description, ticketPriority, userId],
    );
    const ticketCreated = result.rows[0];
    res.status(201).json({
      status: "success",
      ticket: ticketCreated,
    });
  } catch (err) {
    console.error("Error inside createTicket controller", err.message);
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "support" || userRole === "admin") {
      const result = await pool.query(
        "SELECT * FROM tickets ORDER BY created_at DESC",
      );
      return res.status(200).json({
        status: "success",
        count: result.rowCount,
        tickets: result.rows,
      });
    }
    if (userRole === "customer") {
      const result = await pool.query(
        "SELECT * FROM tickets WHERE created_by = $1 ORDER BY created_at DESC",
        [userId],
      );
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
  try {
    const ticketId = req.params.id;
    const { status } = req.body;
    const userRole = req.user.role;
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
    const compareStatus = allowedStatus.includes(status);
    if (!compareStatus) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status",
      });
    }
    const result = await pool.query(
      "UPDATE tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, title, description, priority, status, created_by, assigned_to, updated_at",
      [status, ticketId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    return res.status(200).json({
      status: "success",
      message: "Ticket updated successfully",
      ticket: result.rows[0],
    });
  } catch (err) {
    console.error(
      "An unexpected error occurred in updateTicketStatus Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.assignTicket = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { assigned_to } = req.body;
    const ticketId = req.params.id;

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

    const userQuery = await pool.query(
      "SELECT id, role FROM users WHERE id = $1 AND is_active = true",
      [assigned_to],
    );

    const assignedUser = userQuery.rows[0];

    if (!assignedUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (assignedUser.role !== "support" && assignedUser.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Assigned user must be authorized",
      });
    }

    const result = await pool.query(
      "UPDATE tickets SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, title, status, priority, created_by, assigned_to, updated_at",
      [assignedUser.id, ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Ticket updated successfully",
      ticket: result.rows[0],
    });
  } catch (err) {
    console.error(
      "An unexpected error occurred in asignTicket Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { comment } = req.body;
    const ticket_id = req.params.id;
    const author_id = req.user.id;
    const userRole = req.user.role;
    if (!userRole) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden",
      });
    }
    if (!comment) {
      return res.status(400).json({
        status: "error",
        message: "Comment is required",
      });
    }
    const ticketQuery = await pool.query(
      "SELECT id, created_by FROM tickets WHERE id = $1",
      [ticket_id],
    );
    const ticket = ticketQuery.rows[0];
    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "Ticket not found",
      });
    }
    const isStaff = userRole === "support" || userRole === "admin";
    const isTicketOwner =
      userRole === "customer" && author_id === ticket.created_by;
    if (!isStaff && !isTicketOwner) {
      return res.status(403).json({
        status: "error",
        message: "You are not allowed to comment",
      });
    }
    const result = await pool.query(
      "INSERT INTO ticket_comments (ticket_id, author_id, comment) VALUES ($1, $2, $3) RETURNING id, ticket_id, author_id, comment, created_at",
      [ticket_id, author_id, comment],
    );
    const commentCreated = result.rows[0];
    res.status(201).json({
      status: "success",
      message: "Comment created successfully",
      comment: commentCreated,
    });
  } catch (err) {
    console.error(
      "An unexpected error occurred in createComment Controller",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
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
      userRole === "customer" && author_id === ticket.created_by;

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

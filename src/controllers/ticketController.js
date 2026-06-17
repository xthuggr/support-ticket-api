const ticketService = require("../services/ticketService");

exports.createTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket({
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      userId: req.user.id,
    });
    return res.status(200).json({
      status: "success",
      ticket: ticket,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTickets = async (req, res, next) => {
  try {
    const ticketsData = await ticketService.getTickets({
      userId: req.user.id,
      userRole: req.user.role,
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({
      status: "success",
      page: ticketsData.page,
      limit: ticketsData.limit,
      count: ticketsData.count,
      total: ticketsData.total,
      totalPages: ticketsData.totalPages,
      tickets: ticketsData.tickets,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTicketById = async (req, res, next) => {
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
    next(err);
  }
};

exports.updateTicketStatus = async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicketStatus({
      ticketId: req.params.id,
      status: req.body.status,
      userRole: req.user.role,
      userId: req.user.id,
    });
    return res.status(200).json({
      status: "success",
      message: "Ticket updated",
      ticket: ticket,
    });
  } catch (err) {
    next(err);
  }
};

exports.assignTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.assignTicket({
      userRole: req.user.role,
      assigned_to: req.body.assigned_to,
      ticketId: req.params.id,
      userId: req.user.id,
    });
    return res.status(200).json({
      status: "success",
      message: "Ticket assigned successfully",
      ticket: ticket,
    });
  } catch (err) {
    next(err);
  }
};

exports.createComment = async (req, res, next) => {
  try {
    const comment = await ticketService.createComment({
      comment: req.body.comment,
      ticketId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return res.status(201).json({
      status: "success",
      message: "Comment created successfully",
      comment: comment,
    });
  } catch (err) {
    next(err);
  }
};

exports.getComments = async (req, res, next) => {
  try {
    const comments = await ticketService.getComments({
      userRole: req.user.role,
      ticketId: req.params.id,
      userId: req.user.id,
    });
    return res.status(200).json({
      status: "success",
      comments: comments,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTicketActivity = async (req, res, next) => {
  try {
    const ticketActivity = await ticketService.getTicketActivity({
      ticketId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return res.status(200).json({
      status: "success",
      activity: ticketActivity,
    });
  } catch (err) {
    next(err);
  }
};
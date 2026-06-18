# Support Ticket Management API

This project simulates a support ticket management system commonly used in SaaS and IT support environments.

The goal was to practice backend development concepts while building a realistic business application that includes authentication, authorization, ticket workflows, comments, activity tracking, search, filtering, and pagination.

## Key Concepts Implemented

- JWT Authentication
- Role-Based Authorization
- Service Layer Architecture
- Custom Error Handling
- Global Error Middleware
- PostgreSQL Transactions
- Search and Filtering
- Pagination
- Audit Logging
- Reusable Authorization Helpers

## Overview

A RESTful ticket management API built with Node.js, Express, and PostgreSQL.

The application allows customers to create support tickets, while support agents and administrators can manage ticket status, assignments, comments, and activity history.

This project was built to practice backend development concepts such as authentication, authorization, database design, transactions, service-layer architecture, pagination, and error handling.

## Tech Stack

### Backend

- Node.js
- Express.js

### Database

- PostgreSQL

### Authentication

- JSON Web Tokens (JWT)
- bcrypt

### Tools

- Postman
- Git
- GitHub

## Features

- JWT Authentication and protected routes
- Role-based access control (Customer, Support, Admin)
- Ticket assignment workflow
- Ticket status management
- Ticket activity auditing
- Dynamic search and filtering
- Pagination support
- Service-layer architecture
- Global error handling middleware
- PostgreSQL relational database design

## Roles

### Customer

- Create tickets
- View own tickets
- Add comments to own tickets
- View ticket activity

### Support

- View all tickets
- Assign tickets
- Update ticket status
- Add comments

### Admin

- Full access to all ticket operations

## Architecture

The application follows a layered architecture:

```
Routes
  ↓
Controllers
  ↓
Services
  ↓
PostgreSQL Database
```

### Responsibilities

- Routes: Define API endpoints.
- Controllers: Handle requests and responses.
- Services: Contain business logic.
- Database: Persist application data.

## API Endpoints

Protected routes require a valid JWT token using the Authorization header.

### Authentication

Login

POST /auth/login

Request body:

{
"email": "support@example.com",
"password": "password123"
}

Example response:

{
"status": "success",
"token": "jwt_token_here"
}

### Tickets

Create ticket

POST /tickets

Request body:

{
"title": "Login issue",
"description": "User cannot access the dashboard.",
"priority": "high"
}

Example response:

{
"status": "success",
"ticket": {
"id": "ticket_uuid",
"title": "Login issue",
"description": "User cannot access the dashboard.",
"status": "open",
"priority": "high",
"created_by": "user_uuid",
"assigned_to": null,
"created_at": "2026-06-01T12:00:00.000Z"
}
}

Get tickets

GET /tickets

Supports filtering, search, and pagination:

GET /tickets?status=open&priority=high&search=login&page=1&limit=10

Example response:

{
"status": "success",
"page": 1,
"limit": 10,
"count": 1,
"total": 1,
"totalPages": 1,
"tickets": []
}

Get ticket by ID

GET /tickets/:id

Example response:

{
"status": "success",
"ticket": {
"id": "ticket_uuid",
"title": "Login issue",
"description": "User cannot access the dashboard.",
"status": "open",
"priority": "high"
}
}

Update ticket status

PATCH /tickets/:id/status

Request body:

{
"status": "in_progress"
}

Example response:

{
"status": "success",
"message": "Ticket updated",
"ticket": {
"id": "ticket_uuid",
"status": "in_progress"
}
}

Assign ticket

PATCH /tickets/:id/assign

Request body:

{
"assigned_to": "support_user_uuid"
}

Example response:

{
"status": "success",
"message": "Ticket assigned successfully",
"ticket": {
"id": "ticket_uuid",
"assigned_to": "support_user_uuid"
}
}

### Comments

Create comment

POST /tickets/:id/comments

Request body:

{
"comment": "I am reviewing this issue."
}

Example response:

{
"status": "success",
"message": "Comment created successfully",
"comment": {
"id": "comment_uuid",
"ticket_id": "ticket_uuid",
"author_id": "user_uuid",
"comment": "I am reviewing this issue.",
"created_at": "2026-06-01T12:00:00.000Z"
}
}

Get comments

GET /tickets/:id/comments

Example response:

{
"status": "success",
"comments": []
}

### Activity

Get ticket activity

GET /tickets/:id/activity

Example response:

{

"status": "success",
"activity": [
    {
      "id": "activity_uuid",
      "ticket_id": "ticket_uuid",
      "actor_id": "user_uuid",
      "action": "ticket_created",
      "details": "Ticket was created",
      "created_at": "2026-06-01T12:00:00.000Z"
    }
]   
}

## Database Diagram

### users

Stores user accounts, authentication information, and roles.

users
  ├── id
  ├── username
  ├── email
  ├── password_hash
  ├── role
  └── is_active

### tickets

Stores support requests and ticket ownership information.

tickets
  ├── id
  ├── title
  ├── description
  ├── status
  ├── priority
  ├── created_by ───────→ users.id
  └── assigned_to ──────→ users.id

### ticket_comments

Stores discussions associated with tickets.

ticket_comments
  ├── id
  ├── ticket_id ────────→ tickets.id
  ├── author_id ────────→ users.id
  └── comment

### ticket_activity

Stores an audit trail of ticket actions such as status changes, assignments, and comments.

ticket_activity
  ├── id
  ├── ticket_id ────────→ tickets.id
  ├── actor_id ─────────→ users.id
  ├── action
  └── details

## Installation

1. Clone repository

git clone https://github.com/xthuggr/support-ticket-api.git

2. Install dependencies

npm install

3. Configure environment variables

4. Run migrations / create database tables

5. Start server

npm run dev

## Environment Variables

PORT=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
JWT_SECRET=

## Future Improvements

- Automated testing
- Docker support
- File attachments
- Email notifications
- Ticket categories
- API documentation with Swagger

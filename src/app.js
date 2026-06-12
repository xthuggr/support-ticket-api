require("dotenv").config();
const express = require("express");
const app = express();
const healthRoutes = require("./routes/healthRoutes");
const dbRoutes = require("./routes/dbRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/db-check", dbRoutes);
app.use("/users", userRoutes);
app.use("/auth", authRoutes);
app.use("/tickets", ticketRoutes);
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

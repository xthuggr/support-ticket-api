require("dotenv").config();
const express = require("express");
const app = express();
const healthRoutes = require("./routes/healthRoutes");
const dbRoutes = require("./routes/dbRoutes");

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/db-check", dbRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

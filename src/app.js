const express = require("express");
const app = express();
const healthRoutes = require("./routes/healthRoutes");
require("dotenv").config();

app.use(express.json());

app.use("/health", healthRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

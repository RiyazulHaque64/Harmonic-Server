const express = require("express");
const cors = require("cors");

// configure express app
const app = express();

// port cofigure
const port = process.env.PORT || 5000;

// use middleware
app.use(express.json());
app.use(cors());

// main api
app.get("/", (req, res) => {
  res.send("Harmonic server is running ....");
});

// port listener
app.listen(port, () => {
  console.log(`Harmonic server is running on port ${port}`);
});

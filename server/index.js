const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (req, res) => {
  res.json({ status: "OK", bot: "AUTO NUMBER BOT" });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

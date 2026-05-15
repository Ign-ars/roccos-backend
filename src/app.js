const express = require("express");
const cors = require("cors");
const path = require("path");

const trabajosRoutes = require("./routes/trabajosRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos subidos
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Servir PDFs generados
app.use("/pdfs", express.static(path.join(__dirname, "../pdfs")));

app.get("/", (req, res) => {
  res.json({
    mensaje: "Backend funcionando correctamente 🚀"
  });
});

app.use("/api/trabajos", trabajosRoutes);
app.use("/api/auth", authRoutes);

module.exports = app;
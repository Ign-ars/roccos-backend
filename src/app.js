const express = require("express");
const cors = require("cors");
const path = require("path");

const trabajosRoutes = require("./routes/trabajosRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://roccos-dashboard.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origen no permitido por CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// archivos
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/pdfs", express.static(path.join(__dirname, "../pdfs")));

app.get("/", (req, res) => {
  res.json({
    mensaje: "Backend Rocco's Mantención Industrial funcionando correctamente",
  });
});

app.use("/api/trabajos", trabajosRoutes);
app.use("/api/auth", authRoutes);

module.exports = app;
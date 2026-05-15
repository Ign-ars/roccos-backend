require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

global.io = io;

io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado:", socket.id);
  });
});

async function iniciarServidor() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conexión a MySQL exitosa");
    connection.release();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al conectar con MySQL:", error.message);
    process.exit(1);
  }
}

iniciarServidor();
const express = require("express");
const router = express.Router();

const {
  registrarUsuario,
  loginUsuario,
  guardarTokenFcm
} = require("../controllers/authController");

const verificarToken = require("../middleware/authMiddleware");

router.post("/register", registrarUsuario);
router.post("/login", loginUsuario);
router.post("/guardar-token-fcm", verificarToken, guardarTokenFcm);

module.exports = router;
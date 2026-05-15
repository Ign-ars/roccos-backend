const express = require("express");
const router = express.Router();

const {
  obtenerTrabajos,
  obtenerTrabajosDisponibles,
  obtenerMisTrabajos,
  obtenerTrabajoPorId,
  crearTrabajo,
  aceptarTrabajo,
  actualizarTrabajo,
  actualizarEstadoInforme,
  finalizarTrabajo,
  subirFotosTrabajo,
  obtenerFotosTrabajo
} = require("../controllers/trabajosController");

const verificarToken = require("../middleware/authMiddleware");
const upload = require("../config/multer");

// Listados
router.get("/", verificarToken, obtenerTrabajos);
router.get("/disponibles", verificarToken, obtenerTrabajosDisponibles);
router.get("/mis-trabajos", verificarToken, obtenerMisTrabajos);

// Detalle
router.get("/:id", verificarToken, obtenerTrabajoPorId);

// Crear / aceptar / actualizar / informe / finalizar
router.post("/", verificarToken, crearTrabajo);
router.put("/:id/aceptar", verificarToken, aceptarTrabajo);
router.put("/:id", verificarToken, actualizarTrabajo);
router.put("/:id/estado-informe", verificarToken, actualizarEstadoInforme);
router.put("/:id/finalizar", verificarToken, finalizarTrabajo);

// Fotos
router.post(
  "/:id/fotos",
  verificarToken,
  upload.array("fotos", 10),
  subirFotosTrabajo
);

router.get("/:id/fotos", verificarToken, obtenerFotosTrabajo);

module.exports = router;
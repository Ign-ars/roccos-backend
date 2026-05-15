const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token no proporcionado"
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "clave_super_secreta_temporal"
    );

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token inválido o expirado"
    });
  }
};

module.exports = verificarToken;
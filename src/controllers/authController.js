const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Registrar usuario
const registrarUsuario = async (req, res) => {
  try {
    const { nombre, apellido, correo, password, rol } = req.body;

    if (!nombre || !apellido || !correo || !password || !rol) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios"
      });
    }

    if (!["TRABAJADOR", "ADMIN"].includes(rol)) {
      return res.status(400).json({
        error: "Rol inválido. Debe ser TRABAJADOR o ADMIN"
      });
    }

    const [usuariosExistentes] = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (usuariosExistentes.length > 0) {
      return res.status(409).json({
        error: "Ya existe un usuario con ese correo"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, correo, password_hash, rol)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, apellido, correo, passwordHash, rol]
    );

    res.status(201).json({
      mensaje: "Usuario registrado correctamente",
      id_usuario: resultado.insertId
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({
      error: "Error interno al registrar usuario"
    });
  }
};

// Login
const loginUsuario = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        error: "Correo y contraseña son obligatorios"
      });
    }

    const [usuarios] = await pool.query(
      `SELECT id_usuario, nombre, apellido, correo, password_hash, rol, activo
       FROM usuarios
       WHERE correo = ?`,
      [correo]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        error: "Credenciales incorrectas"
      });
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      return res.status(403).json({
        error: "Usuario desactivado"
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({
        error: "Credenciales incorrectas"
      });
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        rol: usuario.rol
      },
      process.env.JWT_SECRET || "clave_super_secreta_temporal",
      { expiresIn: "8h" }
    );

    res.json({
      mensaje: "Login correcto",
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      error: "Error interno en el login"
    });
  }
};

// Guardar token FCM del usuario autenticado
const guardarTokenFcm = async (req, res) => {
  try {
    const { token_fcm } = req.body;
    const idUsuario = req.usuario.id_usuario;

    if (!token_fcm) {
      return res.status(400).json({
        error: "El token_fcm es obligatorio"
      });
    }

    await pool.query(
      `UPDATE usuarios
       SET fcm_token = ?
       WHERE id_usuario = ?`,
      [token_fcm, idUsuario]
    );

    res.json({
      mensaje: "Token FCM guardado correctamente"
    });
  } catch (error) {
    console.error("Error al guardar token FCM:", error);
    res.status(500).json({
      error: "Error interno al guardar token FCM"
    });
  }
};

module.exports = {
  registrarUsuario,
  loginUsuario,
  guardarTokenFcm
};
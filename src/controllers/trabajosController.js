const pool = require("../config/db");
const { generarPdfTrabajo } = require("../services/pdfService");
const admin = require("../config/firebase");

const selectTrabajosBase = `
  SELECT 
    t.id_trabajo,
    t.titulo,
    t.sector,
    t.descripcion,
    t.prioridad,
    t.estado,
    t.fecha_creacion,
    t.fecha_toma,
    t.hora_inicio,
    t.hora_termino,
    t.observaciones_cierre,
    t.pdf_url,
    t.estado_informe,
    t.fecha_cobro,
    t.cobrado_por,
    t.creado_por,
    t.id_usuario_asignado,
    uc.nombre AS nombre_creador,
    uc.apellido AS apellido_creador,
    ua.nombre AS nombre_asignado,
    ua.apellido AS apellido_asignado,
    ucb.nombre AS nombre_cobrado_por,
    ucb.apellido AS apellido_cobrado_por
  FROM trabajos t
  INNER JOIN usuarios uc ON t.creado_por = uc.id_usuario
  LEFT JOIN usuarios ua ON t.id_usuario_asignado = ua.id_usuario
  LEFT JOIN usuarios ucb ON t.cobrado_por = ucb.id_usuario
`;

const obtenerTrabajos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${selectTrabajosBase}
      ORDER BY t.fecha_creacion DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener trabajos:", error);
    res.status(500).json({ error: "Error al obtener los trabajos" });
  }
};

const obtenerTrabajosDisponibles = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${selectTrabajosBase}
      WHERE t.estado = 'DISPONIBLE'
      ORDER BY t.fecha_creacion DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener trabajos disponibles:", error);
    res.status(500).json({ error: "Error al obtener trabajos disponibles" });
  }
};

const obtenerMisTrabajos = async (req, res) => {
  try {
    const idUsuario = req.usuario.id_usuario;

    const [rows] = await pool.query(
      `
      ${selectTrabajosBase}
      WHERE t.id_usuario_asignado = ?
      ORDER BY 
        CASE 
          WHEN t.estado = 'EN_PROCESO' THEN 1
          WHEN t.estado = 'FINALIZADO' THEN 2
          ELSE 3
        END,
        t.fecha_creacion DESC
      `,
      [idUsuario]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener mis trabajos:", error);
    res.status(500).json({ error: "Error al obtener mis trabajos" });
  }
};

const obtenerTrabajoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      ${selectTrabajosBase}
      WHERE t.id_trabajo = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Trabajo no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener trabajo por ID:", error);
    res.status(500).json({ error: "Error al obtener el trabajo" });
  }
};

const crearTrabajo = async (req, res) => {
  try {
    const { titulo, sector, descripcion, prioridad = "MEDIA" } = req.body;
    const creado_por = req.usuario.id_usuario;

    const prioridadesPermitidas = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

    if (!titulo || !sector || !descripcion) {
      return res.status(400).json({
        error: "Faltan campos obligatorios"
      });
    }

    if (!prioridadesPermitidas.includes(prioridad)) {
      return res.status(400).json({
        error: "Prioridad inválida"
      });
    }

    const [result] = await pool.query(
      `INSERT INTO trabajos 
       (titulo, sector, descripcion, prioridad, estado, estado_informe, creado_por)
       VALUES (?, ?, ?, ?, 'DISPONIBLE', 'NO_COBRADO', ?)`,
      [titulo, sector, descripcion, prioridad, creado_por]
    );

    const idTrabajo = result.insertId;

    await pool.query(
      `INSERT INTO notificaciones (id_usuario, mensaje)
       SELECT id_usuario, ?
       FROM usuarios
       WHERE rol = 'TRABAJADOR'`,
      [`Nuevo trabajo disponible: ${titulo}`]
    );

    try {
      const [usuariosConToken] = await pool.query(
        `SELECT fcm_token
         FROM usuarios
         WHERE rol = 'TRABAJADOR'
           AND fcm_token IS NOT NULL
           AND fcm_token <> ''`
      );

      const tokens = usuariosConToken
        .map((u) => u.fcm_token)
        .filter(Boolean);

      if (tokens.length > 0) {
        const response = await admin.messaging().sendEachForMulticast({
          data: {
            title: "Nuevo trabajo disponible",
            body: titulo,
            tipo: "nuevo_trabajo",
            id_trabajo: String(idTrabajo),
            abrir_trabajos: "true"
          },
          android: {
            priority: "high"
          },
          tokens
        });

        const tokensInvalidos = [];

        response.responses.forEach((r, index) => {
          if (!r.success) {
            const code = r.error?.code || "";
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              tokensInvalidos.push(tokens[index]);
            }
          }
        });

        if (tokensInvalidos.length > 0) {
          await pool.query(
            `UPDATE usuarios
             SET fcm_token = NULL
             WHERE fcm_token IN (?)`,
            [tokensInvalidos]
          );
        }
      }
    } catch (errorFcm) {
      console.error("Error enviando FCM al crear trabajo:", errorFcm);
    }

    if (global.io) {
      global.io.emit("nuevo_trabajo", {
        id_trabajo: idTrabajo,
        titulo,
        sector,
        descripcion,
        prioridad,
        estado: "DISPONIBLE",
        estado_informe: "NO_COBRADO"
      });

      global.io.emit("trabajos_refrescar");
    }

    res.status(201).json({
      mensaje: "Trabajo publicado correctamente",
      id_trabajo: idTrabajo
    });

  } catch (error) {
    console.error("Error al crear trabajo:", error);
    res.status(500).json({ error: "Error al crear el trabajo" });
  }
};

const aceptarTrabajo = async (req, res) => {
  try {
    const { id } = req.params;
    const idUsuario = req.usuario.id_usuario;

    const [trabajos] = await pool.query(
      `SELECT estado FROM trabajos WHERE id_trabajo = ?`,
      [id]
    );

    if (trabajos.length === 0) {
      return res.status(404).json({ error: "Trabajo no encontrado" });
    }

    if (trabajos[0].estado !== "DISPONIBLE") {
      return res.status(400).json({ error: "No disponible" });
    }

    await pool.query(
      `UPDATE trabajos
       SET estado='EN_PROCESO',
           id_usuario_asignado=?,
           fecha_toma=CURRENT_TIMESTAMP,
           hora_inicio=CURRENT_TIMESTAMP
       WHERE id_trabajo=?`,
      [idUsuario, id]
    );

    await pool.query(
      `INSERT INTO notificaciones (id_usuario, mensaje)
       VALUES (?, ?)`,
      [idUsuario, "Tomaste un trabajo en proceso"]
    );

    if (global.io) {
      global.io.emit("trabajo_actualizado", {
        id_trabajo: Number(id),
        estado: "EN_PROCESO",
        id_usuario_asignado: idUsuario
      });

      global.io.emit("trabajos_refrescar");
    }

    res.json({ mensaje: "Trabajo aceptado" });

  } catch (error) {
    console.error("Error al aceptar trabajo:", error);
    res.status(500).json({ error: "Error al aceptar" });
  }
};

const finalizarTrabajo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      observaciones_cierre,
      estado_informe = "NO_COBRADO"
    } = req.body;

    const idUsuario = req.usuario.id_usuario;

    if (!["NO_COBRADO", "COBRADO"].includes(estado_informe)) {
      return res.status(400).json({
        error: "Estado de informe inválido"
      });
    }

    const fechaCobro = estado_informe === "COBRADO" ? new Date() : null;
    const cobradoPor = estado_informe === "COBRADO" ? idUsuario : null;

    await pool.query(
      `UPDATE trabajos
       SET estado = 'FINALIZADO',
           hora_termino = CURRENT_TIMESTAMP,
           observaciones_cierre = ?,
           estado_informe = ?,
           fecha_cobro = ?,
           cobrado_por = ?
       WHERE id_trabajo = ?`,
      [
        observaciones_cierre,
        estado_informe,
        fechaCobro,
        cobradoPor,
        id
      ]
    );

    const [trabajo] = await pool.query(
      `
      ${selectTrabajosBase}
      WHERE t.id_trabajo = ?
      `,
      [id]
    );

    const [fotos] = await pool.query(
      `SELECT * FROM fotos_trabajo WHERE id_trabajo = ?`,
      [id]
    );

    const pdf = await generarPdfTrabajo(trabajo[0], fotos);

    await pool.query(
      `UPDATE trabajos SET pdf_url = ? WHERE id_trabajo = ?`,
      [pdf, id]
    );

    await pool.query(
      `INSERT INTO notificaciones (id_usuario, mensaje)
       VALUES (?, ?)`,
      [idUsuario, "Trabajo finalizado correctamente"]
    );

    if (global.io) {
      global.io.emit("trabajo_actualizado", {
        id_trabajo: Number(id),
        estado: "FINALIZADO",
        estado_informe,
        fecha_cobro: fechaCobro,
        cobrado_por: cobradoPor,
        pdf_url: pdf
      });

      global.io.emit("trabajos_refrescar");
    }

    res.json({
      mensaje: "Trabajo finalizado correctamente",
      pdf_url: pdf,
      estado_informe
    });

  } catch (error) {
    console.error("Error al finalizar trabajo:", error);
    res.status(500).json({ error: "Error al finalizar" });
  }
};

const subirFotosTrabajo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Sin imágenes" });
    }

    for (const file of req.files) {
      await pool.query(
        `INSERT INTO fotos_trabajo (id_trabajo, url_imagen, nombre_archivo)
         VALUES (?, ?, ?)`,
        [id, `/uploads/${file.filename}`, file.filename]
      );
    }

    if (global.io) {
      global.io.emit("trabajo_actualizado", {
        id_trabajo: Number(id),
        fotos_actualizadas: true
      });

      global.io.emit("trabajos_refrescar");
    }

    res.json({ mensaje: "Fotos subidas" });

  } catch (error) {
    console.error("Error al subir fotos:", error);
    res.status(500).json({ error: "Error fotos" });
  }
};

const obtenerFotosTrabajo = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM fotos_trabajo WHERE id_trabajo=?`,
      [id]
    );

    res.json(rows);

  } catch (error) {
    console.error("Error al obtener fotos:", error);
    res.status(500).json({ error: "Error fotos" });
  }
};

const actualizarTrabajo = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, sector, descripcion, prioridad = "MEDIA" } = req.body;
    const idUsuario = req.usuario.id_usuario;

    const prioridadesPermitidas = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

    if (!titulo || !sector || !descripcion) {
      return res.status(400).json({
        error: "Faltan campos obligatorios: titulo, sector, descripcion"
      });
    }

    if (!prioridadesPermitidas.includes(prioridad)) {
      return res.status(400).json({
        error: "Prioridad inválida"
      });
    }

    const [usuarioRows] = await pool.query(
      `SELECT rol FROM usuarios WHERE id_usuario = ?`,
      [idUsuario]
    );

    const rolUsuario = usuarioRows[0]?.rol;

    let result;

    if (rolUsuario === "ADMIN") {
      [result] = await pool.query(
        `
        UPDATE trabajos
        SET titulo = ?, sector = ?, descripcion = ?, prioridad = ?
        WHERE id_trabajo = ?
        `,
        [titulo, sector, descripcion, prioridad, id]
      );
    } else {
      [result] = await pool.query(
        `
        UPDATE trabajos
        SET titulo = ?, sector = ?, descripcion = ?, prioridad = ?
        WHERE id_trabajo = ?
          AND estado = 'EN_PROCESO'
          AND id_usuario_asignado = ?
        `,
        [titulo, sector, descripcion, prioridad, id, idUsuario]
      );
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Trabajo no encontrado, no está en proceso o no tienes permisos"
      });
    }

    if (global.io) {
      global.io.emit("trabajo_actualizado", {
        id_trabajo: Number(id),
        titulo,
        sector,
        descripcion,
        prioridad
      });

      global.io.emit("trabajos_refrescar");
    }

    res.json({
      mensaje: "Trabajo actualizado correctamente"
    });

  } catch (error) {
    console.error("Error al actualizar trabajo:", error);
    res.status(500).json({ error: "Error al actualizar el trabajo" });
  }
};

const actualizarEstadoInforme = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_informe } = req.body;
    const idUsuario = req.usuario.id_usuario;

    if (!["NO_COBRADO", "COBRADO"].includes(estado_informe)) {
      return res.status(400).json({
        error: "Estado de informe inválido"
      });
    }

    const [usuarioRows] = await pool.query(
      `SELECT rol FROM usuarios WHERE id_usuario = ?`,
      [idUsuario]
    );

    if (usuarioRows.length === 0 || usuarioRows[0].rol !== "ADMIN") {
      return res.status(403).json({
        error: "Solo un administrador puede cambiar el estado del informe"
      });
    }

    const fechaCobro = estado_informe === "COBRADO" ? new Date() : null;
    const cobradoPor = estado_informe === "COBRADO" ? idUsuario : null;

    const [result] = await pool.query(
      `
      UPDATE trabajos
      SET estado_informe = ?,
          fecha_cobro = ?,
          cobrado_por = ?
      WHERE id_trabajo = ?
      `,
      [estado_informe, fechaCobro, cobradoPor, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Trabajo no encontrado"
      });
    }

    if (global.io) {
      global.io.emit("trabajo_actualizado", {
        id_trabajo: Number(id),
        estado_informe
      });

      global.io.emit("trabajos_refrescar");
    }

    res.json({
      mensaje:
        estado_informe === "COBRADO"
          ? "Informe marcado como cobrado"
          : "Informe marcado como no cobrado"
    });

  } catch (error) {
    console.error("Error al actualizar estado informe:", error);
    res.status(500).json({
      error: "Error al actualizar el estado del informe"
    });
  }
};

module.exports = {
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
};
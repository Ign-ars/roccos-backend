const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generarPdfTrabajo = async (trabajo, fotos = []) => {
  return new Promise((resolve, reject) => {
    try {
      const pdfDir = path.join(__dirname, "../../pdfs");
      const logoPath = path.join(__dirname, "../assets/roccos_logo.png");

      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const nombreArchivo = `trabajo_${trabajo.id_trabajo}_${Date.now()}.pdf`;
      const rutaCompleta = path.join(pdfDir, nombreArchivo);
      const rutaPublica = `/pdfs/${nombreArchivo}`;

      const doc = new PDFDocument({
        margin: 36,
        size: "A4",
        bufferPages: true,
      });

      const stream = fs.createWriteStream(rutaCompleta);
      doc.pipe(stream);

      dibujarHeader(doc, logoPath, trabajo);
      dibujarTituloReporte(doc, trabajo);

      dibujarBloqueInfo(doc, trabajo);
      dibujarBloqueDescripcion(doc, trabajo);
      dibujarBloqueObservaciones(doc, trabajo);
      dibujarBloqueFotos(doc, fotos, logoPath, trabajo);

      agregarFooter(doc);

      doc.end();

      stream.on("finish", () => resolve(rutaPublica));
      stream.on("error", (error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
};

const dibujarHeader = (doc, logoPath, trabajo) => {
  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageWidth - doc.page.margins.right;

  doc.rect(0, 0, pageWidth, 86).fill("#111827");
  doc.rect(0, 82, pageWidth, 4).fill("#D32F2F");

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left, 18, {
        fit: [68, 44],
      });
    } catch {
      dibujarLogoFallback(doc, left, 20);
    }
  } else {
    dibujarLogoFallback(doc, left, 20);
  }

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("ROCCO'S MANTENCIÓN INDUSTRIAL", left + 82, 20, {
      width: 330,
    });

  doc
    .fillColor("#D1D5DB")
    .font("Helvetica")
    .fontSize(8.5)
    .text("Informe técnico de trabajo", left + 82, 42)
    .text("Gestión administrativa y operacional", left + 82, 56);

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`OT-${String(trabajo.id_trabajo || "").padStart(5, "0")}`, right - 115, 22, {
      width: 115,
      align: "right",
    });

  doc
    .fillColor("#D1D5DB")
    .font("Helvetica")
    .fontSize(8)
    .text(`Generado: ${formatearFecha(new Date())}`, right - 190, 42, {
      width: 190,
      align: "right",
    });

  doc.y = 104;
};

const dibujarHeaderContinuacion = (doc, logoPath, trabajo) => {
  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageWidth - doc.page.margins.right;

  doc.rect(0, 0, pageWidth, 56).fill("#111827");
  doc.rect(0, 53, pageWidth, 3).fill("#D32F2F");

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left, 13, {
        fit: [46, 30],
      });
    } catch {
      dibujarLogoFallback(doc, left, 12, 42, 30);
    }
  } else {
    dibujarLogoFallback(doc, left, 12, 42, 30);
  }

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(11.5)
    .text("ROCCO'S MANTENCIÓN INDUSTRIAL", left + 58, 15, {
      width: 290,
    });

  doc
    .fillColor("#D1D5DB")
    .font("Helvetica")
    .fontSize(7.5)
    .text("Continuación de informe técnico", left + 58, 31);

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(`OT-${String(trabajo.id_trabajo || "").padStart(5, "0")}`, right - 100, 20, {
      width: 100,
      align: "right",
    });

  doc.y = 76;
};

const dibujarLogoFallback = (doc, x, y, width = 54, height = 38) => {
  doc.roundedRect(x, y, width, height, 7).fill("#D32F2F");

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("R", x, y + height / 2 - 8, {
      width,
      align: "center",
    });
};

const dibujarTituloReporte = (doc, trabajo) => {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const titulo = trabajo.titulo || "Trabajo sin título";
  const fecha = formatearFechaSoloDia(trabajo.hora_termino || trabajo.fecha_creacion);

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(`Reporte ${titulo.toUpperCase()} | ${fecha}`, x, doc.y, {
      width,
      align: "center",
      underline: true,
    });

  doc.y += 24;
};

const dibujarBloqueInfo = (doc, trabajo) => {
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const gap = 10;
  const colWidth = (width - gap) / 2;
  const labelWidth = 96;
  const rowHeight = 22;

  const izquierda = [
    ["Nombre trabajo", trabajo.titulo || "No disponible"],
    ["Sector", trabajo.sector || "No disponible"],
    ["Responsable", nombreCompleto(trabajo.nombre_creador, trabajo.apellido_creador)],
    ["Técnico asignado", nombreCompleto(trabajo.nombre_asignado, trabajo.apellido_asignado)],
    ["Prioridad", formatearEnum(trabajo.prioridad)],
    ["Estado trabajo", formatearEnum(trabajo.estado)],
    ["Estado informe", formatearEnum(trabajo.estado_informe || "NO_COBRADO")],
  ];

  const derecha = [
    ["ID trabajo", trabajo.id_trabajo || "No disponible"],
    ["Fecha creación", formatearFecha(trabajo.fecha_creacion)],
    ["Fecha toma", formatearFecha(trabajo.fecha_toma)],
    ["Hora inicio", formatearFecha(trabajo.hora_inicio)],
    ["Hora término", formatearFecha(trabajo.hora_termino)],
    ["Fecha cobro", formatearFecha(trabajo.fecha_cobro)],
    ["Cobrado por", nombreCompleto(trabajo.nombre_cobrado_por, trabajo.apellido_cobrado_por)],
  ];

  const totalRows = Math.max(izquierda.length, derecha.length);
  const blockHeight = totalRows * rowHeight;

  dibujarColumnaInfo(doc, x, y, colWidth, labelWidth, rowHeight, izquierda);
  dibujarColumnaInfo(doc, x + colWidth + gap, y, colWidth, labelWidth, rowHeight, derecha);

  doc.y = y + blockHeight + 12;
};

const dibujarColumnaInfo = (doc, x, y, width, labelWidth, rowHeight, filas) => {
  filas.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;

    doc
      .rect(x, rowY, labelWidth, rowHeight)
      .fill("#F3F4F6")
      .strokeColor("#111827")
      .lineWidth(0.6)
      .stroke();

    doc
      .rect(x + labelWidth, rowY, width - labelWidth, rowHeight)
      .fill("#FFFFFF")
      .strokeColor("#111827")
      .lineWidth(0.6)
      .stroke();

    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(7.8)
      .text(label, x + 5, rowY + 6, {
        width: labelWidth - 10,
      });

    doc
      .fillColor("#111827")
      .font("Helvetica")
      .fontSize(7.9)
      .text(String(value || "No disponible"), x + labelWidth + 6, rowY + 6, {
        width: width - labelWidth - 12,
        ellipsis: true,
      });
  });
};

const dibujarBloqueDescripcion = (doc, trabajo) => {
  const texto = trabajo.descripcion || "Sin descripción registrada.";
  dibujarCajaTecnica(doc, "Descripción del trabajo", texto, 76);
};

const dibujarBloqueObservaciones = (doc, trabajo) => {
  const texto = trabajo.observaciones_cierre || "Sin observaciones finales registradas.";
  dibujarCajaTecnica(doc, "Observaciones finales", texto, 58);
};

const dibujarCajaTecnica = (doc, titulo, texto, alturaMinima) => {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 20;
  const padding = 8;

  const textHeight = doc.heightOfString(texto, {
    width: width - padding * 2,
    lineGap: 2,
  });

  const bodyHeight = Math.max(alturaMinima, textHeight + padding * 2);
  const y = doc.y;

  const limite = doc.page.height - doc.page.margins.bottom - 44;
  if (y + headerHeight + bodyHeight > limite) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  const newY = doc.y;

  doc
    .rect(x, newY, width, headerHeight)
    .fill("#F3F4F6")
    .strokeColor("#111827")
    .lineWidth(0.6)
    .stroke();

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(titulo, x, newY + 6, {
      width,
      align: "center",
    });

  doc
    .rect(x, newY + headerHeight, width, bodyHeight)
    .fill("#FFFFFF")
    .strokeColor("#111827")
    .lineWidth(0.6)
    .stroke();

  doc
    .fillColor("#111827")
    .font("Helvetica")
    .fontSize(8.8)
    .text(texto, x + padding, newY + headerHeight + padding, {
      width: width - padding * 2,
      lineGap: 2,
    });

  doc.y = newY + headerHeight + bodyHeight + 10;
};

const dibujarBloqueFotos = (doc, fotos, logoPath, trabajo) => {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  dibujarEncabezadoFotos(doc, "Evidencia fotográfica");

  if (!fotos || fotos.length === 0) {
    doc
      .rect(x, doc.y, width, 38)
      .fill("#FFFFFF")
      .strokeColor("#111827")
      .lineWidth(0.6)
      .stroke();

    doc
      .fillColor("#667085")
      .font("Helvetica")
      .fontSize(8.8)
      .text("No hay fotos asociadas a este trabajo.", x + 8, doc.y + 13, {
        width: width - 16,
      });

    doc.y += 48;
    return;
  }

  const columns = 3;
  const cellWidth = width / columns;
  const cellHeight = 116;
  const imagePadding = 7;

  fotos.forEach((foto, index) => {
    const col = index % columns;

    if (col === 0) {
      const limite = doc.page.height - doc.page.margins.bottom - 48;

      if (doc.y + cellHeight > limite) {
        doc.addPage();
        dibujarHeaderContinuacion(doc, logoPath, trabajo);
        dibujarEncabezadoFotos(doc, "Evidencia fotográfica");
      }
    }

    const rowY = doc.y;
    const cellX = x + col * cellWidth;

    doc
      .rect(cellX, rowY, cellWidth, cellHeight)
      .fill("#FFFFFF")
      .strokeColor("#111827")
      .lineWidth(0.6)
      .stroke();

    const rutaRelativa = (foto.url_imagen || "").replace(/^\/+/, "");
    const rutaImagen = path.join(__dirname, "../../", rutaRelativa);

    if (fs.existsSync(rutaImagen)) {
      try {
        doc.image(rutaImagen, cellX + imagePadding, rowY + imagePadding, {
          fit: [cellWidth - imagePadding * 2, cellHeight - imagePadding * 2],
          align: "center",
          valign: "center",
        });
      } catch {
        dibujarErrorImagen(doc, cellX, rowY, cellWidth, cellHeight, "No se pudo insertar imagen.");
      }
    } else {
      dibujarErrorImagen(doc, cellX, rowY, cellWidth, cellHeight, "Imagen no encontrada.");
    }

    if (col === columns - 1 || index === fotos.length - 1) {
      doc.y = rowY + cellHeight;
    }
  });

  doc.y += 8;
};

const dibujarEncabezadoFotos = (doc, titulo) => {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const limite = doc.page.height - doc.page.margins.bottom - 70;
  if (doc.y + 22 > limite) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  doc
    .rect(x, doc.y, width, 20)
    .fill("#F3F4F6")
    .strokeColor("#111827")
    .lineWidth(0.6)
    .stroke();

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(titulo, x, doc.y + 6, {
      width,
      align: "center",
    });

  doc.y += 20;
};

const dibujarErrorImagen = (doc, x, y, width, height, mensaje) => {
  doc
    .fillColor("#D32F2F")
    .font("Helvetica")
    .fontSize(8)
    .text(mensaje, x + 8, y + height / 2 - 6, {
      width: width - 16,
      align: "center",
    });
};

const agregarFooter = (doc) => {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const bottom = doc.page.height - 32;

    doc
      .strokeColor("#D32F2F")
      .lineWidth(1)
      .moveTo(left, bottom - 10)
      .lineTo(right, bottom - 10)
      .stroke();

    doc
      .fillColor("#111827")
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        "Rocco's Mantención Industrial · Informe generado automáticamente por el sistema",
        left,
        bottom,
        {
          width: 370,
        }
      );

    doc
      .fillColor("#111827")
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Página ${i + 1} de ${range.count}`, right - 90, bottom, {
        width: 90,
        align: "right",
      });
  }
};

const formatearFecha = (fecha) => {
  if (!fecha) return "No disponible";

  const f = new Date(fecha);

  if (Number.isNaN(f.getTime())) return "No disponible";

  return f.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatearFechaSoloDia = (fecha) => {
  if (!fecha) return "Sin fecha";

  const f = new Date(fecha);

  if (Number.isNaN(f.getTime())) return "Sin fecha";

  return f.toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatearEnum = (valor) => {
  if (!valor) return "No disponible";

  return String(valor)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
};

const nombreCompleto = (nombre, apellido) => {
  const completo = `${nombre || ""} ${apellido || ""}`.trim();
  return completo || "No disponible";
};

module.exports = {
  generarPdfTrabajo,
};
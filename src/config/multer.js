const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const extensionOriginal = path.extname(file.originalname).toLowerCase();

    const extension =
      extensionOriginal ||
      (file.mimetype === "image/jpeg" ? ".jpg" :
      file.mimetype === "image/png" ? ".png" :
      file.mimetype === "image/webp" ? ".webp" :
      file.mimetype === "image/heic" ? ".heic" :
      file.mimetype === "image/heif" ? ".heif" :
      "");

    const nombreBase = path
      .basename(file.originalname || "imagen", extensionOriginal)
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "");

    const nombreFinal = `${Date.now()}-${nombreBase || "imagen"}${extension}`;
    cb(null, nombreFinal);
  }
});

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  const extension = path.extname(file.originalname || "").toLowerCase();

  const extensionesPermitidas = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif"
  ];

  const mimesPermitidos = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif"
  ];

  const esMimeValido = mimesPermitidos.includes(mime);
  const esExtensionValida = extensionesPermitidas.includes(extension);

  // Acepta si el MIME es válido o si la extensión es válida
  if (esMimeValido || esExtensionValida) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Formato no permitido. MIME recibido: ${file.mimetype}, archivo: ${file.originalname}`
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = upload;
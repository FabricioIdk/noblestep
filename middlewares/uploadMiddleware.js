 

const multer = require('multer');
const path = require('path');
const fs = require('fs');  

const CARPETA_DESTINO = path.join(__dirname, '..', 'public', 'img', 'productos');

if (!fs.existsSync(CARPETA_DESTINO)) {
  fs.mkdirSync(CARPETA_DESTINO, { recursive: true });

}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {

    cb(null, CARPETA_DESTINO);
  },
  filename: (req, file, cb) => {

    const extension = path.extname(file.originalname).toLowerCase();  

    const nombreLimpio = path.basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');

    const nombreFinal = `${Date.now()}-${nombreLimpio}${extension}`;

    cb(null, nombreFinal);
  },
});

function filtroImagenes(req, file, cb) {
  const permitidos = ['.jpg', '.jpeg', '.png', '.webp'];
  const extension = path.extname(file.originalname).toLowerCase();
  if (permitidos.includes(extension)) {
    cb(null, true);  
  } else {
    cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP.'));  
  }
}

const upload = multer({
  storage,
  fileFilter: filtroImagenes,
  limits: { fileSize: 3 * 1024 * 1024 },  

});

module.exports = upload;

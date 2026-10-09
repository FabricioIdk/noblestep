 

const nodemailer = require('nodemailer');

const SMTP_CONFIGURADO = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transportador = null;
if (SMTP_CONFIGURADO) {
  transportador = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,  
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,  
    },
  });
}

async function enviarCorreo({ destinatario, asunto, textoPlano, html }) {
  if (!SMTP_CONFIGURADO) {

    console.log('\n--- CORREO NO ENVIADO (falta configurar SMTP_USER y SMTP_PASS en .env) ---');
    console.log('Para:', destinatario);
    console.log('Asunto:', asunto);
    console.log('Contenido:', textoPlano);
    console.log('--- fin del correo ---\n');
    return { enviado: false };
  }

  try {
    await transportador.sendMail({
      from: `"Noble Step" <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: asunto,
      text: textoPlano,
      html: html || `<p>${textoPlano}</p>`,
    });
    return { enviado: true };
  } catch (error) {

    console.error('Error enviando correo:', error.message);
    return { enviado: false, error: error.message };
  }
}

module.exports = { enviarCorreo, SMTP_CONFIGURADO };

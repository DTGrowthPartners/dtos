import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'gtxm1111.siteground.biz',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'admin@dtgrowthpartners.com',
    pass: process.env.SMTP_PASS || '',
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const mailOptions = {
    from: `"DT Growth Partners" <${process.env.SMTP_USER || 'admin@dtgrowthpartners.com'}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Error al enviar el email');
  }
};

// Verify connection configuration
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified');
    return true;
  } catch (error) {
    console.error('SMTP connection error:', error);
    return false;
  }
};

// Email templates
export const sendClientAccessEmail = async (
  email: string,
  firstName: string,
  clientName: string,
  passwordResetLink: string
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://os.dtgrowthpartners.com';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Acceso al Portal de Clientes</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 40px 30px; text-align: center;">
                  <img src="https://dtgrowthpartners.com/assets/DT-GROWTH-LOGO-DYCI6Arf.png" alt="DT Growth Partners" style="max-width: 200px; height: auto;">
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #18181b;">
                    ¡Hola ${firstName}!
                  </h1>

                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #52525b;">
                    Se ha creado tu cuenta de acceso al portal de clientes de <strong>${clientName}</strong> en DT Growth Partners.
                  </p>

                  <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #0369a1;">
                      <strong>Tu usuario:</strong> ${email}
                    </p>
                  </div>

                  <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #52525b;">
                    Para activar tu cuenta, haz clic en el siguiente botón para establecer tu contraseña:
                  </p>

                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${passwordResetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);">
                      Establecer mi contraseña
                    </a>
                  </div>

                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #52525b;">
                    Una vez establecida tu contraseña, podrás iniciar sesión en:
                  </p>

                  <p style="margin: 0 0 30px 0; font-size: 16px;">
                    <a href="${frontendUrl}/login" style="color: #0ea5e9; text-decoration: none; font-weight: 500;">${frontendUrl}/login</a>
                  </p>

                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #52525b;">
                    En el portal podrás ver:
                  </p>

                  <ul style="margin: 0 0 30px 0; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #52525b;">
                    <li>Dashboard con métricas de marketing</li>
                    <li>Estado de tus campañas activas</li>
                    <li>Presupuesto vs Ventas</li>
                    <li>Estado de servicios contratados</li>
                    <li>Reportes y documentos</li>
                  </ul>

                  <p style="margin: 30px 0 0 0; font-size: 14px; color: #71717a;">
                    Si no puedes hacer clic en el botón, copia y pega esta URL en tu navegador:
                  </p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; word-break: break-all; color: #0ea5e9;">
                    ${passwordResetLink}
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f4f4f5; padding: 30px; text-align: center;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #71717a;">
                    © ${new Date().getFullYear()} DT Growth Partners. Todos los derechos reservados.
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                    Este email fue enviado a ${email} porque se ha creado tu cuenta en el portal de clientes.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Tu acceso al Portal de Clientes - ${clientName}`,
    html,
  });
};

import nodemailer, { type Transporter } from "nodemailer";
import { ENTORNO } from "./entorno";

let transporte: Transporter | null = null;

function obtenerTransporte(): Transporter | null {
  if (transporte) return transporte;
  if (!ENTORNO.SMTP_HOST) return null;

  transporte = nodemailer.createTransport({
    host: ENTORNO.SMTP_HOST,
    port: ENTORNO.SMTP_PORT,
    secure: ENTORNO.SMTP_SECURE,
    auth: ENTORNO.SMTP_USER
      ? { user: ENTORNO.SMTP_USER, pass: ENTORNO.SMTP_PASS }
      : undefined,
  });

  return transporte;
}

export async function enviarCodigoVerificacion(
  destino: string,
  codigo: string
): Promise<void> {
  const asunto = "Código de verificación - Campus Metaverso";
  const texto = `Tu código de verificación es ${codigo}. Expira en 10 minutos.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="margin:0 0 12px;color:#7a1f2b">Campus Metaverso</h2>
      <p>Usa este código para verificar tu correo y crear tu cuenta:</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:24px 0;color:#7a1f2b">${codigo}</p>
      <p>El código expira en 10 minutos.</p>
      <p style="font-size:12px;color:#6b7280">Si no solicitaste este código, puedes ignorar este mensaje.</p>
    </div>
  `;

  const envio = obtenerTransporte();

  if (!envio) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP no configurado");
    }

    console.log(`[correo] Código para ${destino}: ${codigo}`);
    return;
  }

  await envio.sendMail({
    from: ENTORNO.SMTP_FROM || ENTORNO.SMTP_USER || "no-reply@campus.local",
    to: destino,
    subject: asunto,
    text: texto,
    html,
  });
}

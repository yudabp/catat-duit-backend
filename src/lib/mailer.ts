import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

type MailInput = {
  to: string;
  subject: string;
  heading: string;
  body: string[];
  actionLabel?: string;
  actionUrl?: string;
  footer?: string;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHtml(input: MailInput): string {
  const body = input.body
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;line-height:1.6;color:#374151">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const action =
    input.actionLabel && input.actionUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${escapeHtml(input.actionLabel)}</a></p>`
      : "";

  const footer = input.footer
    ? `<p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#6B7280">${escapeHtml(input.footer)}</p>`
    : "";

  return `<!doctype html>
<html lang="id">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:28px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
          <tr><td>
            <p style="margin:0 0 22px;font-size:18px;font-weight:700;color:#111827">${escapeHtml(env.APP_NAME)}</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827">${escapeHtml(input.heading)}</h1>
            ${body}
            ${action}
            ${footer}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendMail(input: MailInput): Promise<void> {
  const text = [
    input.heading,
    "",
    ...input.body,
    ...(input.actionUrl ? ["", input.actionUrl] : []),
    ...(input.footer ? ["", input.footer] : []),
  ].join("\n");

  if (env.EMAIL_TRANSPORT === "log" || !resend) {
    logger.warn(
      { to: input.to, subject: input.subject, preview: text },
      "EMAIL_TRANSPORT=log — email tidak dikirim. Isi email di atas hanya untuk development.",
    );
    return;
  }

  const result = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: renderHtml(input),
    text,
  });

  if (result.error) {
    throw new Error(`Resend gagal mengirim email: ${result.error.message}`);
  }
}

function fireAndForget(input: MailInput): void {
  void sendMail(input).catch((error: unknown) => {
    logger.error(
      { err: error, to: input.to, subject: input.subject },
      "Gagal mengirim email transaksional",
    );
  });
}

export function sendResetPasswordEmail(data: {
  to: string;
  name: string;
  token: string;
}): void {
  const url = new URL(env.APP_RESET_PASSWORD_URL);
  url.searchParams.set("token", data.token);

  fireAndForget({
    to: data.to,
    subject: `Reset kata sandi ${env.APP_NAME}`,
    heading: "Reset kata sandi",
    body: [
      `Hai ${data.name}, kami menerima permintaan untuk mereset kata sandi akun ${env.APP_NAME} kamu.`,
      "Buka tautan di bawah dari ponsel untuk membuat kata sandi baru. Tautan berlaku selama 1 jam.",
      "Kalau kamu tidak merasa meminta reset kata sandi, abaikan email ini. Kata sandi kamu tidak akan berubah.",
    ],
    actionLabel: "Buat kata sandi baru",
    actionUrl: url.toString(),
    footer: `Kode reset: ${data.token}`,
  });
}

export function sendVerificationEmail(data: {
  to: string;
  name: string;
  url: string;
}): void {
  fireAndForget({
    to: data.to,
    subject: `Verifikasi email ${env.APP_NAME}`,
    heading: "Verifikasi alamat email",
    body: [
      `Hai ${data.name}, konfirmasi alamat email ini supaya akun ${env.APP_NAME} kamu tetap aman.`,
      "Tautan verifikasi berlaku selama 1 jam.",
    ],
    actionLabel: "Verifikasi email",
    actionUrl: data.url,
    footer:
      "Kalau kamu tidak meminta perubahan email, abaikan email ini dan hubungi dukungan.",
  });
}

export function sendEmailChangeConfirmation(data: {
  to: string;
  name: string;
  newEmail: string;
  url: string;
}): void {
  fireAndForget({
    to: data.to,
    subject: `Konfirmasi perubahan email ${env.APP_NAME}`,
    heading: "Konfirmasi perubahan email",
    body: [
      `Hai ${data.name}, ada permintaan untuk mengubah email akun ${env.APP_NAME} kamu menjadi ${data.newEmail}.`,
      "Klik tombol di bawah untuk menyetujui perubahan ini. Tautan berlaku selama 1 jam.",
      "Kalau bukan kamu yang meminta, abaikan email ini. Email akun tidak akan berubah.",
    ],
    actionLabel: "Setujui perubahan email",
    actionUrl: data.url,
  });
}

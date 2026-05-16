import type { SmtpSettings, TeamInvitation } from "@profilex/shared";
import net from "node:net";
import tls from "node:tls";
import type { AppDatabase } from "../database/db.js";
import { getSmtpSettings } from "./settingsService.js";

type SmtpSocket = net.Socket | tls.TLSSocket;

export async function sendInvitationEmail(db: AppDatabase, invitation: TeamInvitation, displayName: string) {
  const settings = await getSmtpSettings(db, { includePassword: true });
  if (!settings.enabled) return { sent: false, skipped: true, reason: "SMTP is disabled" };
  if (!settings.host || !settings.fromEmail) return { sent: false, skipped: true, reason: "SMTP settings are incomplete" };

  const subject = "ProfileX invitation";
  const text = [
    `Hello ${displayName},`,
    "",
    "You have been invited to the company ProfileX.",
    `Open this invite link to join: ${invitation.inviteUrl}`,
    "",
    "If you did not expect this invitation, ignore this email."
  ].join("\r\n");

  await sendMail(settings, {
    to: invitation.email,
    subject,
    text
  });

  return { sent: true, skipped: false };
}

export async function testSmtpSettings(settings: SmtpSettings) {
  const client = new SmtpClient(settings);
  await client.connect();
  await client.quit();
  return { ok: true };
}

async function sendMail(settings: SmtpSettings, message: { to: string; subject: string; text: string }) {
  const client = new SmtpClient(settings);
  await client.connect();
  const from = formatAddress(settings.fromEmail, settings.fromName);
  await client.command(`MAIL FROM:<${settings.fromEmail}>`, [250]);
  await client.command(`RCPT TO:<${message.to}>`, [250, 251]);
  await client.command("DATA", [354]);
  await client.writeData(
    [
      `From: ${from}`,
      `To: <${message.to}>`,
      `Subject: ${message.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(16).slice(2)}@profilex.local>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      message.text
    ].join("\r\n")
  );
  await client.quit();
}

class SmtpClient {
  private socket?: SmtpSocket;
  private buffer = "";

  constructor(private readonly settings: SmtpSettings) {}

  async connect() {
    this.socket = await this.openSocket(this.settings.secure);
    await this.readResponse([220]);
    await this.command("EHLO profilex.local", [250]);
    if (!this.settings.secure && this.settings.startTls) {
      await this.command("STARTTLS", [220]);
      this.socket = await this.upgradeToTls(this.socket as net.Socket);
      this.buffer = "";
      await this.command("EHLO profilex.local", [250]);
    }
    if (this.settings.username && this.settings.password) {
      const token = Buffer.from(`\0${this.settings.username}\0${this.settings.password}`).toString("base64");
      await this.command(`AUTH PLAIN ${token}`, [235]);
    }
  }

  async command(command: string, expectedCodes: number[]) {
    this.socket?.write(`${command}\r\n`);
    return this.readResponse(expectedCodes);
  }

  async writeData(data: string) {
    this.socket?.write(`${data}\r\n.\r\n`);
    return this.readResponse([250]);
  }

  async quit() {
    if (!this.socket || this.socket.destroyed) return;
    await this.command("QUIT", [221]).catch(() => undefined);
    this.socket.end();
  }

  private openSocket(secure: boolean) {
    return new Promise<SmtpSocket>((resolve, reject) => {
      const socket = secure
        ? tls.connect({ host: this.settings.host, port: this.settings.port, servername: this.settings.host })
        : net.createConnection({ host: this.settings.host, port: this.settings.port });
      socket.setTimeout(15000);
      const readyEvent = secure ? "secureConnect" : "connect";
      socket.once(readyEvent, () => resolve(socket));
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("SMTP connection timed out"));
      });
      socket.once("error", reject);
    });
  }

  private upgradeToTls(socket: net.Socket) {
    return new Promise<tls.TLSSocket>((resolve, reject) => {
      const secureSocket = tls.connect({ socket, servername: this.settings.host });
      secureSocket.setTimeout(15000);
      secureSocket.once("secureConnect", () => resolve(secureSocket));
      secureSocket.once("timeout", () => {
        secureSocket.destroy();
        reject(new Error("SMTP STARTTLS connection timed out"));
      });
      secureSocket.once("error", reject);
    });
  }

  private readResponse(expectedCodes: number[]) {
    return new Promise<string>((resolve, reject) => {
      const socket = this.socket;
      if (!socket) return reject(new Error("SMTP socket is not connected"));

      const cleanup = () => {
        socket.off("data", onData);
        socket.off("error", onError);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1];
        if (!last || !/^\d{3}\s/.test(last)) return;
        this.buffer = "";
        cleanup();
        const code = Number(last.slice(0, 3));
        if (expectedCodes.includes(code)) resolve(lines.join("\n"));
        else reject(new Error(`SMTP error ${code}: ${lines.join(" ")}`));
      };

      socket.on("data", onData);
      socket.once("error", onError);
    });
  }
}

function formatAddress(email: string, name: string) {
  return name ? `"${name.replace(/"/g, "'")}" <${email}>` : `<${email}>`;
}

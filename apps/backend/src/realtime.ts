import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";
import type { AuthUser } from "@profilex/shared";

let wss: WebSocketServer | undefined;
export function attachRealtime(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket, request) => {
    const token = new URL(request.url ?? "", "http://localhost").searchParams.get("token");
    try { (socket as any).user = token ? jwt.verify(token, JWT_SECRET) as AuthUser : undefined; } catch { socket.close(1008, "Unauthorized"); }
  });
}
export function broadcast(event: string, data: unknown) {
  const payload = JSON.stringify({ event, data });
  for (const client of wss?.clients ?? []) if (client.readyState === WebSocket.OPEN) client.send(payload);
}

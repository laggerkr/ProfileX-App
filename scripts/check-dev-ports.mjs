import net from "node:net";

const ports = [4387, 5173];

async function isPortBusy(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

const busy = [];
for (const port of ports) {
  if (await isPortBusy(port)) busy.push(port);
}

if (busy.length) {
  console.error(`Dev ports are already in use: ${busy.join(", ")}`);
  console.error("Close the previous dev terminal or stop the owning process, then run npm.cmd run dev again.");
  if (process.platform === "win32") {
    console.error("Windows helper:");
    console.error("  Get-NetTCPConnection -LocalPort 5173,4387 | Select-Object LocalPort,OwningProcess");
    console.error("  Stop-Process -Id <PID>");
  }
  process.exit(1);
}

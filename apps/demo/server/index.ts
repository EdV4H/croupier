import { startNodeServer } from "@croupier/server/node";
import { registry } from "./shared/game-registry.js";
import { createLogger } from "./shared/logger.js";

const port = Number(process.env.PORT) || 9615;

const server = startNodeServer({
  registry,
  port,
  logger: createLogger("local"),
  onListen: (p) => console.log(`Croupier demo server running on http://localhost:${p}`),
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try: kill $(lsof -ti:${port})`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

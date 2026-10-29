import { createCloudflareServer } from "@croupier/server/cloudflare";
import { registry } from "../shared/game-registry.js";
import { createLogger } from "../shared/logger.js";

const server = createCloudflareServer({ registry, logger: createLogger("workers") });

export const { GameRoomDO, LobbyDO } = server;
export default server.worker;

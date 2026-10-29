import { createCloudflareServer } from "../../src/adapters/cloudflare.js";
import { registry } from "../fixtures.js";

/** Clock shared by the Durable Objects and the tests (same isolate) */
export const testClock = { offset: 0, now: () => Date.now() + testClock.offset };

const server = createCloudflareServer({ registry, clock: testClock });

export const { GameRoomDO, LobbyDO } = server;
export default server.worker;

import type { CroupierEnv } from "../../src/adapters/cloudflare.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends CroupierEnv {}
}

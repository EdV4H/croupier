const SECRET_KEY = "croupier-secret";

/** Per-browser secret proving to the server that this browser owns its player name in a room */
export function getPlayerSecret(): string {
  let secret = localStorage.getItem(SECRET_KEY);
  if (!secret) {
    secret = crypto.randomUUID();
    localStorage.setItem(SECRET_KEY, secret);
  }
  return secret;
}

/** JSON body identifying the current player */
export function playerBody(playerId: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ playerId, secret: getPlayerSecret(), ...extra });
}

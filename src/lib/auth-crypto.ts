/** Browser Web Crypto helpers for password hashing (PBKDF2-SHA-256) */

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomSaltHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuf(saltHex) as BufferSource,
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string
): Promise<boolean> {
  const next = await hashPassword(password, saltHex);
  if (next.length !== hashHex.length) return false;
  let ok = 0;
  for (let i = 0; i < next.length; i++) ok |= next.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return ok === 0;
}

export function mandateRef(): string {
  const n = crypto.getRandomValues(new Uint8Array(4));
  const hex = bufToHex(n.buffer).toUpperCase();
  return `BNB-DD-${hex}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const bits = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return bufToHex(bits);
}

/** Random secret suitable for magic-link tokens */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

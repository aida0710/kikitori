/** パスワードの scrypt と、ログインの token・アクセスキーの生成と照合。 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// OWASP の推奨（N=2^17, r=8, p=1）。1 回の照合はおよそ 0.1〜0.3 秒
const SCRYPT_COST = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const SCRYPT_KEY_LENGTH = 32;

export const ACCESS_KEY_PREFIX = "kkt_";
// 画面に出して鍵を見分けるための先頭の文字数（ACCESS_KEY_PREFIX を含む）
const ACCESS_KEY_DISPLAY_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_COST);
  const { N, r, p } = SCRYPT_COST;
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${digest.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltText, digestText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !digestText) {
    return false;
  }
  const expected = Buffer.from(digestText, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltText, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_COST.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

/** token・鍵は 256 bit の乱数なので、保存と照合は塩なしの SHA-256 で足りる。 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateAccessKey(): { key: string; prefix: string } {
  const key = ACCESS_KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, ACCESS_KEY_DISPLAY_LENGTH) };
}

import { randomBytes, scrypt as scryptCallback, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { digest, equalSecret, mac } from "./crypto-state.mjs";
import {
  assertSameOrigin,
  readCookie,
  cookieValue,
  readJson,
  jsonResponse,
} from "./http-security.mjs";
import { reject } from "./errors.mjs";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password, salt = randomBytes(16)) {
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export async function verifyPassword(password, stored) {
  try {
    const parts = stored.split("$");
    if (
      parts.length !== 6 ||
      parts.slice(0, 4).join("$") !== "scrypt$32768$8$1" ||
      !/^[-_a-zA-Z0-9]{22}$/.test(parts[4]) ||
      !/^[-_a-zA-Z0-9]{86}$/.test(parts[5])
    )
      return false;
    return equalSecret(
      await hashPassword(password, Buffer.from(parts[4], "base64url")),
      stored,
    );
  } catch {
    return false;
  }
}
export function base32(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function fromBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    buffer = 0;
  const out = [];
  for (const char of value) {
    const part = alphabet.indexOf(char);
    if (part < 0) throw Error();
    buffer = (buffer << 5) | part;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totpCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", fromBase32(secret)).update(counter).digest(),
    offset = hmac[hmac.length - 1] & 15;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
export function verifyTotp(secret, value, now) {
  if (!/^\d{6}$/.test(value || "")) return null;
  const step = Math.floor(now / 30000);
  for (const delta of [0, -1, 1])
    if (equalSecret(totpCode(secret, step + delta), value)) return step + delta;
  return null;
}
export function adminConfiguration(env) {
  try {
    const url = new URL(env.APP_URL || env.NEXT_PUBLIC_SITE_URL || ""),
      local =
        env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !local) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !/^[A-Za-z0-9._@-]{3,80}$/.test(env.ADMIN_USERNAME || "admin") ||
      !/^scrypt\$32768\$8\$1\$[-_a-zA-Z0-9]{22}\$[-_a-zA-Z0-9]{86}$/.test(
        env.ADMIN_PASSWORD_HASH || "",
      ) ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(env.ADMIN_SESSION_SECRET || "") ||
      (env.ADMIN_TOTP_SECRET &&
        !/^[A-Z2-7]{32,64}$/.test(env.ADMIN_TOTP_SECRET))
    )
      return null;
    return {
      origin: url.origin,
      secure: url.protocol === "https:",
      username: (env.ADMIN_USERNAME || "admin").toLowerCase(),
      passwordHash: env.ADMIN_PASSWORD_HASH,
      sessionSecret: env.ADMIN_SESSION_SECRET,
      totpSecret: env.ADMIN_TOTP_SECRET || "",
    };
  } catch {
    return null;
  }
}
export function createAdminAuth({ config, repository, now = Date.now }) {
  const name = `${config?.secure ? "__Host-" : ""}mn-admin`;
  function configured() {
    if (!config || !repository)
      reject(
        "ADMIN_UNAVAILABLE",
        "Administração indisponível no momento.",
        503,
      );
  }
  function csrf(hash) {
    return mac(config.sessionSecret, "admin-csrf", `${config.origin}:${hash}`);
  }
  async function authenticate(request, mutation = false) {
    configured();
    assertSameOrigin(request, config.origin, mutation);
    const signed = readCookie(request, name) || "",
      parts = signed.split("."),
      token = parts[0];
    if (
      parts.length !== 2 ||
      !/^[A-Za-z0-9_-]{43}$/.test(token || "") ||
      !equalSecret(
        parts[1],
        mac(config.sessionSecret, "admin-session", `${config.origin}:${token}`),
      )
    )
      reject("AUTH_REQUIRED", "Entre novamente para continuar.", 401);
    const hash = digest(token),
      session = await repository.adminSession(hash),
      time = now();
    if (
      !session ||
      session.expires_at <= time ||
      session.last_seen < time - 30 * 60000
    ) {
      if (session) await repository.deleteAdminSession(hash);
      reject("AUTH_REQUIRED", "Sua sessão expirou. Entre novamente.", 401);
    }
    if (
      mutation &&
      !equalSecret(request.headers.get("x-csrf-token"), csrf(hash))
    )
      reject("CSRF_REJECTED", "Atualize o painel e tente novamente.", 403);
    if (session.last_seen < time - 60000)
      await repository.touchAdminSession(hash, time);
    return { hash, csrfToken: csrf(hash), username: config.username };
  }
  async function session(request) {
    if (!config || !repository)
      return jsonResponse({ available: false, authenticated: false });
    try {
      const user = await authenticate(request);
      return jsonResponse({
        available: true,
        authenticated: true,
        csrfToken: user.csrfToken,
        username: user.username,
        mfa: !!config.totpSecret,
      });
    } catch (error) {
      if (error.status === 401)
        return jsonResponse({
          available: true,
          authenticated: false,
          mfa: !!config.totpSecret,
        });
      throw error;
    }
  }
  async function login(request) {
    configured();
    assertSameOrigin(request, config.origin);
    const body = await readJson(request, 4096);
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).some(
        (key) => !["username", "password", "otp"].includes(key),
      ) ||
      typeof body.username !== "string" ||
      body.username.length > 80 ||
      typeof body.password !== "string" ||
      body.password.length > 256 ||
      body.password.length < 1
    )
      reject("LOGIN_FAILED", "Usuário, senha ou código inválido.", 401);
    if (!(await repository.loginLimit("admin-login", 12, 15 * 60000)))
      reject(
        "RATE_LIMIT",
        "Muitas tentativas. Aguarde antes de entrar novamente.",
        429,
      );
    const correct = await verifyPassword(body.password, config.passwordHash);
    if (
      !correct ||
      !equalSecret(body.username.trim().toLowerCase(), config.username)
    )
      reject("LOGIN_FAILED", "Usuário, senha ou código inválido.", 401);
    if (config.totpSecret) {
      const step = verifyTotp(config.totpSecret, body.otp, now());
      if (step === null || !(await repository.consumeTotp(step)))
        reject("LOGIN_FAILED", "Usuário, senha ou código inválido.", 401);
    }
    const token = randomBytes(32).toString("base64url"),
      hash = digest(token);
    await repository.createAdminSession(hash, now());
    await repository.audit("admin.login", "admin");
    const response = jsonResponse({
      authenticated: true,
      csrfToken: csrf(hash),
      username: config.username,
    });
    response.headers.append(
      "Set-Cookie",
      cookieValue(
        name,
        `${token}.${mac(config.sessionSecret, "admin-session", `${config.origin}:${token}`)}`,
        config.secure,
        8 * 3600,
      ).replace("SameSite=Lax", "SameSite=Strict"),
    );
    return response;
  }
  async function logout(request) {
    const user = await authenticate(request, true);
    await repository.deleteAdminSession(user.hash);
    await repository.audit("admin.logout", "admin");
    const response = jsonResponse({ ok: true });
    response.headers.append(
      "Set-Cookie",
      cookieValue(name, "", config.secure, 0).replace(
        "SameSite=Lax",
        "SameSite=Strict",
      ),
    );
    return response;
  }
  return { authenticate, session, login, logout };
}

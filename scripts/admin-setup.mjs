import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { hashPassword, base32 } from "../lib/server/admin-auth.mjs";
if (!process.stdin.isTTY) {
  console.error(
    "Execute este comando em um terminal interativo para digitar sua senha com segurança.",
  );
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const username =
  (await rl.question("Usuário administrativo (padrão admin): ")).trim() ||
  "admin";
rl.close();
if (!/^[A-Za-z0-9._@-]{3,80}$/.test(username)) {
  console.error("Use um usuário de 3 a 80 letras, números ou . _ @ -");
  process.exit(1);
}
async function hidden(prompt) {
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const data = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.off("data", data);
          process.stdin.pause();
          reject(Error("Cancelado"));
          return;
        }
        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.off("data", data);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", data);
  });
}
try {
  const password = await hidden(
      "Senha (mínimo 14 caracteres, entrada oculta): ",
    ),
    again = await hidden("Repita a senha: ");
  if (password.length < 14 || password.length > 256 || password !== again)
    throw Error("As senhas precisam ser iguais e ter 14 a 256 caracteres.");
  const hash = await hashPassword(password),
    secret = randomBytes(32).toString("base64url"),
    totp = base32(randomBytes(20));
  console.log(
    "\nGuarde estes valores no painel da hospedagem. Não envie por chat nem faça commit:\n",
  );
  console.log(
    `ADMIN_USERNAME=${username.toLowerCase()}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${secret}\nADMIN_TOTP_SECRET=${totp}`,
  );
  console.log(
    "\nCadastre a chave ADMIN_TOTP_SECRET no seu autenticador (TOTP, 6 dígitos, 30 segundos). Guarde uma cópia em local seguro.\nA senha original não é exibida nem salva pelo script.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

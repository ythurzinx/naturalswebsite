import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
// The Hostinger build receives the environment too. Never run the e-mail
// outbox in a compiler/prerender worker even when live credentials are present.
const cli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [cli, "build", "--webpack"], {
  stdio: "inherit", env: { ...process.env, MN_BUILD_PHASE: "1" },
});
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });

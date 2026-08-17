import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { pathToFileURL } from "node:url";
import { AuthError, TokenStore, refreshTokens, sendLoginCode, verifyLoginCode } from "./auth.js";
import { loadSettings } from "./config.js";
import { ALL_ENTITIES } from "./endpoints.js";
import { setupLogging } from "./logging.js";
import { SyncRunner } from "./sync.js";

export async function main(argv = process.argv) {
  const { command, flags } = parseArgs(argv);
  if (!command || command === "help" || flags.help) {
    printHelp();
    return command ? 0 : 2;
  }

  const settings = loadSettings();
  mkdirSync(settings.outputDir, { recursive: true });
  mkdirSync(settings.logDir, { recursive: true });
  setupLogging(`${settings.logDir}/parser.log`);

  try {
    if (command === "login") return await cmdLogin(settings, flags);
    if (command === "refresh") return printJson(await cmdRefresh(settings));
    const runner = new SyncRunner(settings);
    if (command === "probe") return printJson(await runner.probe());
    if (command === "sync") {
      if (flags.days && !flags.from && !flags.to) settings.defaultDays = Number(flags.days);
      return printJson(
        await runner.sync({
          dateFrom: flags.from || null,
          dateTo: flags.to || null,
          entities: flags.entities || "sprint1",
          chunkDays: flags["chunk-days"] ? Number(flags["chunk-days"]) : null,
        }),
      );
    }
    if (command === "stability-test") {
      return printJson(
        await runner.stabilityTest({
          runs: flags.runs ? Number(flags.runs) : 3,
          days: flags.days ? Number(flags.days) : 3,
          entities: flags.entities || "sprint1",
        }),
      );
    }
    if (command === "schedule") return cmdSchedule(runner, flags);
    printHelp();
    return 2;
  } catch (error) {
    if (error instanceof AuthError) {
      console.log(JSON.stringify({ status: "auth_error", error: error.message }, null, 2));
      return 2;
    }
    console.log(JSON.stringify({ status: "error", error: error.message }, null, 2));
    return 1;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const flags = {};
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next == null || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
}

function printHelp() {
  console.log(`Adwave parser — read-only internal API client

Usage:
  node src/cli.js <command> [options]

Commands:
  login             WhatsApp OTP login
  refresh           Force access JWT refresh
  probe             Check auth + key endpoints
  sync              Download entities for a date range
  stability-test    Run sync several times
  schedule          Loop sync on an interval

Options:
  --phone           Digits only (login)
  --code            OTP if already received
  --yes             Skip send-code confirmation
  --from YYYY-MM-DD
  --to YYYY-MM-DD
  --days N
  --entities        sprint1 | sprint2 | all | ${ALL_ENTITIES.join(",")}
  --chunk-days N
  --runs N
  --every-hours N
`);
}

async function question(prompt, { silent = false } = {}) {
  if (!silent) {
    const rl = createInterface({ input, output });
    const answer = await new Promise((resolve) => rl.question(prompt, resolve));
    rl.close();
    return String(answer || "").trim();
  }
  output.write(prompt);
  input.setRawMode?.(true);
  input.resume();
  let acc = "";
  return await new Promise((resolve) => {
    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      if (text === "\n" || text === "\r") {
        input.setRawMode?.(false);
        input.pause();
        input.removeListener("data", onData);
        output.write("\n");
        resolve(acc.trim());
        return;
      }
      if (text === "\u0003") process.exit(1);
      if (text === "\u007f" || text === "\b") {
        acc = acc.slice(0, -1);
        return;
      }
      acc += text;
    };
    input.on("data", onData);
  });
}

async function cmdLogin(settings, flags) {
  const phone = String(flags.phone || settings.phone || "").replace(/\D/g, "");
  if (!phone) {
    console.error("Set ADWAVE_PHONE in .env or pass --phone (digits only).");
    return 2;
  }
  const masked = phone.length >= 4 ? `***${phone.slice(-4)}` : "****";
  let code = flags.code ? String(flags.code).trim() : "";
  if (!code) {
    if (!flags.yes) {
      const answer = (await question(`Send WhatsApp OTP to ${masked}? [y/N]: `)).toLowerCase();
      if (!["y", "yes"].includes(answer)) {
        console.log("Cancelled.");
        return 1;
      }
    }
    await sendLoginCode(settings, phone);
    console.log(`OTP sent to ${masked}. Ask the account owner for the code.`);
    code = await question("Enter OTP (input hidden): ", { silent: true });
  }
  const store = new TokenStore(settings);
  const status = await verifyLoginCode(settings, phone, code, store);
  console.log(JSON.stringify({ status: "ok", auth: status, token_file: settings.tokenFile }, null, 2));
  console.log("Tokens saved. Do not paste them into chat or commit them.");
  return 0;
}

async function cmdRefresh(settings) {
  const store = new TokenStore(settings);
  const result = await refreshTokens(settings, store);
  result.token_file = settings.tokenFile;
  return result;
}

async function cmdSchedule(runner, flags) {
  const interval = Math.max(0.1, Number(flags["every-hours"] || 6)) * 3600 * 1000;
  if (flags.days) runner.settings.defaultDays = Number(flags.days);
  console.log(`Scheduling sync every ${flags["every-hours"] || 6}h. Ctrl+C to stop.`);
  while (true) {
    const summary = await runner.sync({ entities: flags.entities || "all" });
    console.log(JSON.stringify({ run_id: summary.run_id, status: summary.status }, null, 2));
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
  const status = String(payload.status || payload.overall_status || "ok");
  if (["failed", "refresh_failed", "needs_login", "auth_error"].includes(status)) return 2;
  if (status === "partial") return 1;
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await main(process.argv);
  process.exit(code);
}

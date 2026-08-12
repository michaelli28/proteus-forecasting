/**
 * Streams a live engine run to the browser.
 *
 * The dashboard has, until now, read only static JSON the engine published
 * ahead of time. That is the right design for a benchmark — a reliability curve
 * derived twice is two implementations of calibration that will eventually
 * disagree — and it is the wrong design for watching a run, because there is
 * nothing to watch.
 *
 * So this route does not reimplement anything. It spawns the SAME CLI a person
 * would run in a terminal, in `--stream` mode, and forwards its newline-delimited
 * JSON to the browser as server-sent events. The engine stays the single source
 * of truth: what the page renders is exactly what the CLI emitted, and if the
 * two ever disagree it is because the page failed to render something, never
 * because it computed something.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENGINE_ROOT = resolve(process.cwd(), "../engine");
const ENGINE_CLI = resolve(ENGINE_ROOT, "dist/cli.js");

/**
 * Arguments are validated against a strict pattern before reaching `spawn`.
 *
 * `spawn` is called with an argument ARRAY and no shell, so there is no
 * injection path even without this. It is here because the failure mode of a
 * malformed id is otherwise a confusing engine stack trace surfaced to the
 * browser, and because a route that takes user input and starts a process
 * should be obviously safe to a reviewer rather than safe-if-you-know-how-spawn-
 * works.
 */
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_SEED = /^[A-Za-z0-9._:-]{1,64}$/;

function clamp(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const pack = params.get("pack") ?? "regional-grid";
  const seed = params.get("seed") ?? "proteus";
  const defense = params.get("defense") ?? "";
  const actors = (params.get("actors") ?? "russia").split(",").filter(Boolean);
  const respondents = (params.get("respondents") ?? "")
    .split(",")
    .filter(Boolean);
  const delayMs = Math.min(
    500,
    Math.max(0, Number(params.get("delay") ?? "40") || 0),
  );

  if (!SAFE_ID.test(pack)) return badRequest(`invalid pack "${pack}"`);
  if (!SAFE_SEED.test(seed)) return badRequest(`invalid seed`);
  if (defense && !SAFE_ID.test(defense)) return badRequest("invalid defense");
  for (const id of [...actors, ...respondents]) {
    if (!SAFE_ID.test(id)) return badRequest(`invalid profile id "${id}"`);
  }
  if (actors.length === 0) return badRequest("at least one actor is required");

  if (!existsSync(ENGINE_CLI)) {
    return badRequest(
      "the engine is not built — run `npm run build` in engine/ first",
    );
  }

  const args = [
    ENGINE_CLI,
    "simulate",
    "--pack",
    pack,
    "--actors",
    actors.join(","),
    "--seed",
    seed,
    "--delay",
    String(delayMs),
    "--stream",
  ];
  if (respondents.length > 0) args.push("--respondents", respondents.join(","));
  if (defense) args.push("--defense", defense);

  // Deep mode spends real money on real model calls, so its knobs are clamped
  // here rather than trusted from a query string. The ceilings are what one
  // person watching one run can reasonably read, which is also roughly what
  // keeps a single run in single-digit dollars.
  if (params.get("deep") === "1") {
    args.push(
      "--deep",
      "--branches",
      String(clamp(params.get("branches"), 1, 8, 4)),
      "--councils",
      String(clamp(params.get("councils"), 1, 10, 4)),
      "--judges",
      String(clamp(params.get("judges"), 0, 5, 4)),
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const child = spawn(process.execPath, args, {
        cwd: ENGINE_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let closed = false;
      const send = (event: string, data: string): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const finish = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the client disconnecting */
        }
      };

      // The child writes NDJSON, which does not necessarily arrive aligned to
      // chunk boundaries. Buffering until a newline is what keeps a split event
      // from reaching the browser as two pieces of invalid JSON.
      let buffer = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) send("run", line);
          newline = buffer.indexOf("\n");
        }
      });

      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        send("fatal", JSON.stringify({ error: error.message }));
        finish();
      });

      child.on("close", (code) => {
        if (buffer.trim()) send("run", buffer.trim());
        if (code !== 0) {
          send(
            "fatal",
            JSON.stringify({
              error: stderr.trim() || `engine exited with code ${code}`,
            }),
          );
        } else {
          send("done", JSON.stringify({ ok: true }));
        }
        finish();
      });

      // A viewer who navigates away must not leave a run burning CPU.
      request.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        finish();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Without this, a proxy that buffers responses turns a live stream into
      // one large delivery at the end, which looks exactly like a hang.
      "x-accel-buffering": "no",
    },
  });
}

#!/usr/bin/env node
import "dotenv/config";

const accessToken = process.env.ASANA_ACCESS_TOKEN?.trim();
if (!accessToken) {
  console.error("Missing ASANA_ACCESS_TOKEN. Copy .env.example to .env and add your Asana PAT.");
  process.exit(1);
}

const timeoutMs = Number.parseInt(process.env.ASANA_TIMEOUT_MS ?? "10000", 10);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10_000);

try {
  const url = new URL("https://app.asana.com/api/1.0/users/me");
  url.searchParams.set("opt_fields", "name,email,workspaces.name");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal: controller.signal,
  });

  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    console.error(`Asana connection failed with HTTP ${response.status}.`);
    if (payload) {
      console.error(JSON.stringify(payload, null, 2));
    }
    process.exitCode = 1;
  } else if (!payload || typeof payload !== "object" || !("data" in payload)) {
    console.error("Asana returned an unexpected response.");
    process.exitCode = 1;
  } else {
    const user = payload.data;
    console.log("Asana connection successful.");
    console.log(JSON.stringify({ user }, null, 2));
  }
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.error("Asana connection test timed out.");
  } else {
    console.error(error instanceof Error ? error.message : "Asana connection test failed.");
  }
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}

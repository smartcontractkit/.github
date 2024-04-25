import { getOctokit } from "@actions/github";
import fetch from "node-fetch";
import * as  nock from "nock";
import path from "path";

export function getTestOctokit(nockbackMode: nock.BackMode) {
  const token = nockbackMode === "lockdown" ? "fake-token" : process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN must be set when recording fixtures");
  }

  return getOctokit(token, {
    request: {
      fetch,
    },
  });
}

export function getNock() {
  const nockBack = nock.back;
  nockBack.fixtures = path.join(__dirname, "../__fixtures__");

  // Change to 'lockdown' to use existing fixtures
  // Valid values = lockdown, record, wild, dryrun, update
  const envNockMode = (process.env.NOCK_BACK_MODE ?? "lockdown") as nock.BackMode;
  nockBack.setMode(envNockMode); // Library will throw if invalid mode supplied through env

  return nockBack;
}
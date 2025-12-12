import { getOctokit } from "@actions/github";
import fetch from "node-fetch";
import * as nock from "nock";
import path from "path";
import { vi } from "vitest";

export function getTestOctokit(nockbackMode: nock.BackMode) {
  const token =
    nockbackMode === "lockdown" ? "fake-token" : process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN must be set when recording fixtures");
  }

  return getOctokit(token, {
    request: {
      fetch,
    },
  });
}

export function getNock(mode?: nock.BackMode) {
  const nockBack = nock.back;
  nockBack.fixtures = path.join(__dirname, "../__fixtures__");

  // Change to 'lockdown' to use existing fixtures
  // Valid values = lockdown, record, wild, dryrun, update
  const envNockMode = (process.env.NOCK_BACK_MODE ??
    mode ??
    "lockdown") as nock.BackMode;
  nockBack.setMode(envNockMode); // Library will throw if invalid mode supplied through env

  nock.enableNetConnect();

  return nockBack;
}

export function coreLoggingStubs(extraMocks: { [key: string]: Function }) {
  return {
    setFailed: vi.fn((msg: string) => {
      console.log(`setFailed (stub): ${msg}`);
    }),
    error: vi.fn((msg: string) => {
      console.log(`error (stub): ${msg}`);
    }),
    warning: vi.fn((msg: string) => {
      console.log(`warn (stub): ${msg}`);
    }),
    info: vi.fn((msg: string) => {
      console.log(`info (stub): ${msg}`);
    }),
    debug: vi.fn((msg: string) => {
      console.log(`debug (stub): ${msg}`);
    }),
    startGroup: vi.fn((title: string) => {
      console.log(`startGroup (stub): ${title}`);
    }),
    endGroup: vi.fn(() => {
      console.log(`endGroup (stub)`);
    }),
    summary: {
      addRaw: vi.fn((markdown: string) => {
        console.log(`summary.addRaw (stub): ${markdown}`);
        return {
          write: async () => {
            console.log(`summary.write (stub)`);
          },
        };
      }),
    },
    ...extraMocks,
  };
}

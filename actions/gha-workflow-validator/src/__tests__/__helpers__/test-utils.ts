import { getOctokit } from "@actions/github";
import fetch from "node-fetch";

export function getTestOctokit(nockbackMode: string) {
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
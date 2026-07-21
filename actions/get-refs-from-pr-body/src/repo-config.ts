export interface RepoConfig {
  pattern: RegExp;
  defaultRef: string;
  outputKey: string;
  owner: string;
  repo: string;
}

export const REPO_CONFIG: Record<string, RepoConfig> = {
  core: {
    pattern: /core ref:\s*(\S+)/i,
    defaultRef: "develop",
    outputKey: "core-ref",
    owner: "smartcontractkit",
    repo: "chainlink",
  },
  solana: {
    pattern: /solana ref:\s*(\S+)/i,
    defaultRef: "develop",
    outputKey: "solana-ref",
    owner: "smartcontractkit",
    repo: "chainlink-solana",
  },
  starknet: {
    pattern: /starknet ref:\s*(\S+)/i,
    defaultRef: "develop",
    outputKey: "starknet-ref",
    owner: "smartcontractkit",
    repo: "chainlink-starknet",
  },
};

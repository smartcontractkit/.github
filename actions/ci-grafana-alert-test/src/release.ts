export type ReleaseOs = "linux" | "darwin";
export type ReleaseArch = "amd64" | "arm64";

export interface AssetSpec {
  os: ReleaseOs;
  arch: ReleaseArch;
  url: string;
}

export function mapOs(runnerOs: string): ReleaseOs {
  switch (runnerOs) {
    case "Linux":
      return "linux";
    case "macOS":
      return "darwin";
    default:
      throw new Error(
        `ci-grafana-alert-test: unsupported runner OS '${runnerOs}'`,
      );
  }
}

export function mapArch(runnerArch: string): ReleaseArch {
  switch (runnerArch) {
    case "X64":
      return "amd64";
    case "ARM64":
      return "arm64";
    default:
      throw new Error(
        `ci-grafana-alert-test: unsupported runner arch '${runnerArch}'`,
      );
  }
}

export function resolveAsset(
  version: string,
  runnerOs: string,
  runnerArch: string,
): AssetSpec {
  const os = mapOs(runnerOs);
  const arch = mapArch(runnerArch);
  const url =
    `https://github.com/smartcontractkit/chainlink-testing-framework/releases/download/` +
    `grafana-alertcheck%2F${version}/grafana-alertcheck-${version}-${os}-${arch}.tar.gz`;
  return { os, arch, url };
}

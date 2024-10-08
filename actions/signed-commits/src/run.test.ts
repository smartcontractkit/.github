import fixturez from "fixturez";
import fs from "fs-extra";
import path from "path";
import nock from "nock";
import writeChangeset from "@changesets/write";
import { Changeset } from "@changesets/types";
import { runVersion } from "./run";
import { exec } from "@actions/exec";

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@actions/core", () => ({
  setFailed: (msg: string) => {
    console.log(`setFailed (stub): ${msg}`);
  },
  error: (msg: string) => {
    console.log(`error (stub): ${msg}`);
  },
  warning: (msg: string) => {
    console.log(`warn (stub): ${msg}`);
  },
  info: (msg: string) => {
    console.log(`info (stub): ${msg}`);
  },
  debug: (msg: string) => {
    console.log(`debug (stub): ${msg}`);
  },
}));

vi.mock("@actions/github", () => ({
  context: {
    repo: {
      owner: "changesets",
      repo: "action",
    },
    ref: "refs/heads/some-branch",
    sha: "xeac7",
  },
}));

vi.mock("@actions/github/lib/utils", () => ({
  GitHub: {
    plugin: () => {
      // function necessary to be used as constructor
      return function () {
        return {
          rest: mockedGithubMethods,
          graphql: vi.fn().mockImplementation((...args: any[]) => {
            expect(args.length).toBe(2);
            expect(args[0]).toContain(
              "mutation($input: CreateCommitOnBranchInput!)",
            );
            expect(args[1].input).toBeDefined();

            return {
              createCommitOnBranch: {
                commit: {
                  url: "https://githhub.com/owner/repo/commit/0123abc3210",
                },
              },
            };
          }),
        };
      };
    },
  },
  getOctokitOptions: vi.fn(),
}));
vi.mock("./git/local-git");

let mockedGithubMethods = {
  search: {
    issuesAndPullRequests: vi.fn(),
  },
  pulls: {
    create: vi.fn(),
  },
  repos: {
    createRelease: vi.fn(),
    getBranch: vi.fn().mockReturnValue({ data: { commit: { sha: "abc" } } }),
  },
};

const f = fixturez(__dirname);

const setupRepo = async (cwd: string) => {
  // link node modules to have changesets available
  await fs.symlink(
    path.join(__dirname, "..", "node_modules"),
    path.join(cwd, "node_modules"),
  );

  // make sure the fixture repo has git available and setup
  await exec("git", ["init"], { cwd });
  await exec("git", ["config", "--local", "user.name", `test-user`], {
    cwd,
  });
  await exec(
    "git",
    ["config", "--local", "user.email", `test-user@testuser.com`],
    { cwd },
  );

  // disable signing
  await exec("git", ["config", "--local", "commit.gpgsign", "false"], { cwd });

  await exec("git", ["add", "."], { cwd });
  await exec("git", ["commit", "-m", "init"], { cwd });
};

const writeChangesets = (changesets: Changeset[], cwd: string) => {
  return Promise.all(changesets.map((commit) => writeChangeset(commit, cwd)));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("version", () => {
  it("creates simple PR", async () => {
    const cwd = f.copy("simple-project");
    setupRepo(cwd);

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } }),
    );

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }));

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "simple-project-pkg-a",
              type: "minor",
            },
            {
              name: "simple-project-pkg-b",
              type: "minor",
            },
          ],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    await runVersion({
      githubToken: "@@GITHUB_TOKEN",
      cwd,
    });

    expect(mockedGithubMethods.pulls.create.mock.calls[0]).toMatchSnapshot();
  });

  it("creates simple PR in draft mode", async () => {
    const cwd = f.copy("simple-project");
    setupRepo(cwd);

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } }),
    );

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }));

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "simple-project-pkg-a",
              type: "minor",
            },
            {
              name: "simple-project-pkg-b",
              type: "minor",
            },
          ],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    await runVersion({
      githubToken: "@@GITHUB_TOKEN",
      cwd,
      prDraft: true,
    });

    expect(mockedGithubMethods.pulls.create.mock.calls[0]).toMatchSnapshot();
  });

  it("only includes bumped packages in the PR body", async () => {
    let cwd = f.copy("simple-project");
    setupRepo(cwd);

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } }),
    );

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }));

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "simple-project-pkg-a",
              type: "minor",
            },
          ],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    await runVersion({
      githubToken: "@@GITHUB_TOKEN",
      cwd,
    });

    expect(mockedGithubMethods.pulls.create.mock.calls[0]).toMatchSnapshot();
  });

  it("doesn't include ignored package that got a dependency update in the PR body", async () => {
    let cwd = f.copy("ignored-package");
    setupRepo(cwd);

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } }),
    );

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }));

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "ignored-package-pkg-b",
              type: "minor",
            },
          ],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    await runVersion({
      githubToken: "@@GITHUB_TOKEN",
      cwd,
    });

    expect(mockedGithubMethods.pulls.create.mock.calls[0]).toMatchSnapshot();
  });

  it("does not include changelog entries if full message exceeds size limit", async () => {
    let cwd = f.copy("simple-project");
    setupRepo(cwd);

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } }),
    );

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }));

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "simple-project-pkg-a",
              type: "minor",
            },
          ],
          summary: `# Non manus superum

## Nec cornibus aequa numinis multo onerosior adde

Lorem markdownum undas consumpserat malas, nec est lupus; memorant gentisque ab
limine auctore. Eatque et promptu deficit, quam videtur aequa est **faciat**,
locus. Potentia deus habebat pia quam qui coniuge frater, tibi habent fertque
viribus. E et cognoscere arcus, lacus aut sic pro crimina fuit tum **auxilium**
dictis, qua, in.

In modo. Nomen illa membra.

> Corpora gratissima parens montibus tum coeperat qua remulus caelum Helenamque?
> Non poenae modulatur Amathunta in concita superi, procerum pariter rapto cornu
> munera. Perrhaebum parvo manus contingere, morari, spes per totiens ut
> dividite proculcat facit, visa.

Adspicit sequitur diffamatamque superi Phoebo qua quin lammina utque: per? Exit
decus aut hac inpia, seducta mirantia extremo. Vidi pedes vetus. Saturnius
fluminis divesque vulnere aquis parce lapsis rabie si visa fulmineis.
`,
        },
      ],
      cwd,
    );

    await runVersion({
      githubToken: "@@GITHUB_TOKEN",
      cwd,
      prBodyMaxCharacters: 1000,
    });

    expect(mockedGithubMethods.pulls.create.mock.calls[0]).toMatchSnapshot();
    expect(mockedGithubMethods.pulls.create.mock.calls[0][0].body).toMatch(
      /The changelog information of each package has been omitted from this message/,
    );
  });

  it("does not include any release information if a message with simplified release info exceeds size limit", async () => {
    let cwd = f.copy("simple-project");
    setupRepo(cwd);

    mockedGithubMethods.search.issuesAndPullRequests.mockImplementationOnce(
      () => ({ data: { items: [] } }),
    );

    mockedGithubMethods.pulls.create.mockImplementationOnce(() => ({
      data: { number: 123 },
    }));

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "simple-project-pkg-a",
              type: "minor",
            },
          ],
          summary: `# Non manus superum

## Nec cornibus aequa numinis multo onerosior adde

Lorem markdownum undas consumpserat malas, nec est lupus; memorant gentisque ab
limine auctore. Eatque et promptu deficit, quam videtur aequa est **faciat**,
locus. Potentia deus habebat pia quam qui coniuge frater, tibi habent fertque
viribus. E et cognoscere arcus, lacus aut sic pro crimina fuit tum **auxilium**
dictis, qua, in.

In modo. Nomen illa membra.

> Corpora gratissima parens montibus tum coeperat qua remulus caelum Helenamque?
> Non poenae modulatur Amathunta in concita superi, procerum pariter rapto cornu
> munera. Perrhaebum parvo manus contingere, morari, spes per totiens ut
> dividite proculcat facit, visa.

Adspicit sequitur diffamatamque superi Phoebo qua quin lammina utque: per? Exit
decus aut hac inpia, seducta mirantia extremo. Vidi pedes vetus. Saturnius
fluminis divesque vulnere aquis parce lapsis rabie si visa fulmineis.
`,
        },
      ],
      cwd,
    );

    await runVersion({
      githubToken: "@@GITHUB_TOKEN",
      cwd,
      prBodyMaxCharacters: 500,
    });

    expect(mockedGithubMethods.pulls.create.mock.calls[0]).toMatchSnapshot();
    expect(mockedGithubMethods.pulls.create.mock.calls[0][0].body).toMatch(
      /All release information have been omitted from this message, as the content exceeds the size limit/,
    );
  });
});

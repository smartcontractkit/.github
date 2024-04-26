import { getInvokeContext } from "../run";

jest.mock('@actions/github', () => ({ context:
  { repo: { owner: 'owner', repo: 'repo' },
    eventName: 'push',
    payload: { before: 'before', after: 'after' }
  }})
);

describe(getInvokeContext.name, () => {
  it("should exit without github token", async () => {
    delete process.env.GITHUB_TOKEN;
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { return undefined as never });
    getInvokeContext();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should return context", async () => {
    process.env.GITHUB_TOKEN = "token"
    const result = getInvokeContext();

    expect(result).toEqual({
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      base: 'before',
      head: 'after',
    });
  });
});

import { ExecaError } from "execa";

export class ExecaErrorMock extends ExecaError {
  declare stdout: string
  declare stderr: string
  constructor(stdout: string, stderr: string) {
    super();
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

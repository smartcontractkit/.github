import { ExecaError } from "execa";

import { BuildExecaOptions } from "../../src/pipeline/build.js";
import { RunExecaOptions } from "../../src/pipeline/run.js";

export class ExecaErrorMockBuild extends ExecaError<BuildExecaOptions> {
  constructor(stdout: string, stderr: string) {
    super();
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class ExecaErrorMockRun extends ExecaError<RunExecaOptions> {
  constructor(stdout: string, stderr: string) {
    super();
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

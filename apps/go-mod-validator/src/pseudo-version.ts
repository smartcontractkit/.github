// This file is a relatively direct translation of https://cs.opensource.google/go/x/mod/+/refs/tags/v0.20.0:module/pseudo.go
// Copyright (c) 2009 The Go Authors. All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:

//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { valid } from "@snyk/go-semver";
import * as semver from "@snyk/go-semver/dist/go/semver";
const pseudoVersionRegex =
  /^v[0-9]+\.(0\.0-|\d+\.\d+-([^+]*\.)?0\.)\d{14}-[A-Za-z0-9]+(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export function isPseudoVersion(v: string): boolean {
  const hyphens = v.split("-").length;
  const validSemver = valid(v);
  const passesRegex = pseudoVersionRegex.test(v);

  return !!(hyphens >= 3 && validSemver && passesRegex);
}

export function pseudoVersionRev(v: string) {
  const { rev } = parsePseudoVersion(v);
  return rev;
}

function parsePseudoVersion(v: string): {
  base: string;
  timestamp: string;
  rev: string;
  build: string;
  err: Error | null;
} {
  if (!isPseudoVersion(v)) {
    throw new Error("pseudo syntax error");
  }

  const build = semver.build(v);
  v = v.replace(build, "");
  const j = v.lastIndexOf("-");
  const rev = v.slice(j + 1);
  v = v.slice(0, j);
  const i = v.lastIndexOf("-");

  if (v.lastIndexOf(".") > i) {
    const j = v.lastIndexOf(".");
    return {
      base: v.slice(0, j),
      timestamp: v.slice(j + 1),
      rev: rev,
      build: build,
      err: null,
    };
  } else {
    return {
      base: v.slice(0, i),
      timestamp: v.slice(i + 1),
      rev: rev,
      build: build,
      err: null,
    };
  }
}

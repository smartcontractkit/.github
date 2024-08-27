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

import { isPseudoVersion, pseudoVersionRev } from "../src/pseudo-version";
import { it, describe, expect } from "vitest";

// https://cs.opensource.google/go/x/mod/+/refs/tags/v0.20.0:module/pseudo_test.go
const pseudoTests = [
  { major: "", older: "", version: "v0.0.0-20060102150405-hash" },
  { major: "v0", older: "", version: "v0.0.0-20060102150405-hash" },
  { major: "v1", older: "", version: "v1.0.0-20060102150405-hash" },
  { major: "v2", older: "", version: "v2.0.0-20060102150405-hash" },
  { major: "unused", older: "v0.0.0", version: "v0.0.1-0.20060102150405-hash" },
  { major: "unused", older: "v1.2.3", version: "v1.2.4-0.20060102150405-hash" },
  {
    major: "unused",
    older: "v1.2.99999999999999999",
    version: "v1.2.100000000000000000-0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.2.3-pre",
    version: "v1.2.3-pre.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.3.0-pre",
    version: "v1.3.0-pre.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v0.0.0--",
    version: "v0.0.0--.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.0.0+metadata",
    version: "v1.0.1-0.20060102150405-hash+metadata",
  },
  {
    major: "unused",
    older: "v2.0.0+incompatible",
    version: "v2.0.1-0.20060102150405-hash+incompatible",
  },
  {
    major: "unused",
    older: "v2.3.0-pre+incompatible",
    version: "v2.3.0-pre.0.20060102150405-hash+incompatible",
  },
];

describe("isPseudoVersion", () => {
  for (const { version, older } of pseudoTests) {
    it(`should return true for pseudo version ${version} and false for non-pseudo version ${older}`, () => {
      const isPseudoV = isPseudoVersion(version);
      const isPseudoOlder = isPseudoVersion(older);
      expect(isPseudoV, `expected ${version} to be a pseudo version`).toBe(
        true,
      );
      expect(
        isPseudoOlder,
        `expected ${older} to not be a pseudo version`,
      ).toBe(false);
    });
  }

  for (const { version, older } of pseudoTests) {
    it(`should return the correct rev of "hash" for pseudo version ${version}`, () => {
      const rev = pseudoVersionRev(version);
      expect(rev, `expected ${version} to have rev "hash"`).toBe("hash");
      expect(() => pseudoVersionRev(older)).toThrowError();
    });
  }
});

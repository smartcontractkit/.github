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
//
// Pseudo-versions
//
// Code authors are expected to tag the revisions they want users to use,
// including prereleases. However, not all authors tag versions at all,
// and not all commits a user might want to try will have tags.
// A pseudo-version is a version with a special form that allows us to
// address an untagged commit and order that version with respect to
// other versions we might encounter.
//
// A pseudo-version takes one of the general forms:
//
//	(1) vX.0.0-yyyymmddhhmmss-abcdef123456
//	(2) vX.Y.(Z+1)-0.yyyymmddhhmmss-abcdef123456
//	(3) vX.Y.(Z+1)-0.yyyymmddhhmmss-abcdef123456+incompatible
//	(4) vX.Y.Z-pre.0.yyyymmddhhmmss-abcdef123456
//	(5) vX.Y.Z-pre.0.yyyymmddhhmmss-abcdef123456+incompatible
//
// If there is no recently tagged version with the right major version vX,
// then form (1) is used, creating a space of pseudo-versions at the bottom
// of the vX version range, less than any tagged version, including the unlikely v0.0.0.
//
// If the most recent tagged version before the target commit is vX.Y.Z or vX.Y.Z+incompatible,
// then the pseudo-version uses form (2) or (3), making it a prerelease for the next
// possible semantic version after vX.Y.Z. The leading 0 segment in the prerelease string
// ensures that the pseudo-version compares less than possible future explicit prereleases
// like vX.Y.(Z+1)-rc1 or vX.Y.(Z+1)-1.
//
// If the most recent tagged version before the target commit is vX.Y.Z-pre or vX.Y.Z-pre+incompatible,
// then the pseudo-version uses form (4) or (5), making it a slightly later prerelease.

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
    };
  } else {
    return {
      base: v.slice(0, i),
      timestamp: v.slice(i + 1),
      rev: rev,
      build: build,
    };
  }
}

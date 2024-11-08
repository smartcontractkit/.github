// import { describe, expect, it, vi } from "vitest";
// import { diffHashFiles } from "../src/hash-tests.js";

// vi.mock("@actions/core", async (importOriginal: any) => ({
//   ...(await importOriginal(typeof import("@actions/core"))),
//   setFailed: (msg: string) => {
//     console.log(`setFailed (stub): ${msg}`);
//   },
//   error: (msg: string) => {
//     console.log(`error (stub): ${msg}`);
//   },
//   warning: (msg: string) => {
//     console.log(`warn (stub): ${msg}`);
//   },
//   info: (msg: string) => {
//     console.log(`info (stub): ${msg}`);
//   },
//   debug: () => {
//     // noop
//   },
// }));

// describe("diffHashFiles", () => {
//   it("should return empty array for empty hash maps", () => {
//     const diff = diffHashFiles({}, {});
//     expect(diff).toEqual([]);
//   });

//   it("should return new entry", () => {
//     const diff = diffHashFiles({}, { a: "1" });
//     expect(diff).toEqual(["a"]);
//   });

//   it("should return modified entries", () => {
//     const diff = diffHashFiles({ a: "0" }, { a: "1" });
//     expect(diff).toEqual(["a"]);
//   });
// });

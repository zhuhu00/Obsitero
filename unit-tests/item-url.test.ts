import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveItemUrl } from "../src/sync/item-url.ts";

function makeItem(fields: Record<string, string | undefined>) {
  return {
    getField(field: string) {
      return fields[field] || "";
    },
  } as Pick<Zotero.Item, "getField">;
}

describe("item url resolution", function () {
  it("prefers the Zotero url field when present", function () {
    const url = resolveItemUrl(
      makeItem({
        url: "https://arxiv.org/abs/2603.12250",
        DOI: "10.48550/arXiv.2603.12250",
      }),
    );

    assert.equal(url, "https://arxiv.org/abs/2603.12250");
  });

  it("falls back to an arXiv abs url derived from DOI", function () {
    const url = resolveItemUrl(
      makeItem({
        DOI: "10.48550/arXiv.2603.12250",
      }),
    );

    assert.equal(url, "https://arxiv.org/abs/2603.12250");
  });

  it("falls back to archiveLocation for arXiv items when url and DOI are empty", function () {
    const url = resolveItemUrl(
      makeItem({
        archive: "arXiv",
        archiveLocation: "2603.12250",
      }),
    );

    assert.equal(url, "https://arxiv.org/abs/2603.12250");
  });

  it("falls back to arXiv ids mentioned in Extra", function () {
    const url = resolveItemUrl(
      makeItem({
        extra: ["Some note", "arXiv: 2603.12250", "Citation Key: dvd2026"].join(
          "\n",
        ),
      }),
    );

    assert.equal(url, "https://arxiv.org/abs/2603.12250");
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  CloudWorkspaceConflictError,
  commitVercelWorkspaceHeadForTests,
  resetVercelWorkspaceForTests,
  setVercelWorkspaceBlobStoreForTests,
} from "./vercel-workspace";

test("the cloud workspace head uses compare-and-swap so one concurrent writer wins", async () => {
  let current: { etag: string; body: string } | null = null;
  let revision = 0;
  const fakeStore = {
    async put(pathname: string, body: unknown, options: { allowOverwrite?: boolean; ifMatch?: string }) {
      assert.equal(pathname, "cabinet-runtime/workspace-v1-head.json");
      if (
        (!options.allowOverwrite && current) ||
        (options.ifMatch && current?.etag !== options.ifMatch)
      ) {
        throw new BlobPreconditionFailedError();
      }
      revision += 1;
      current = { etag: `etag-${revision}`, body: String(body) };
      return {
        pathname,
        etag: current.etag,
        url: "https://blob.invalid/head",
        downloadUrl: "https://blob.invalid/head",
        contentType: "application/json",
        contentDisposition: "inline",
      };
    },
    async get() { return null; },
    async list() { return { blobs: [], cursor: undefined, hasMore: false }; },
    async del() {},
  };
  setVercelWorkspaceBlobStoreForTests(fakeStore as never);

  try {
    const firstRace = await Promise.allSettled([
      commitVercelWorkspaceHeadForTests(
        "cabinet-runtime/snapshots/one.json.gz",
        null,
      ),
      commitVercelWorkspaceHeadForTests(
        "cabinet-runtime/snapshots/two.json.gz",
        null,
      ),
    ]);
    assert.equal(
      firstRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejected = firstRace.find((result) => result.status === "rejected");
    assert.ok(
      rejected?.status === "rejected" &&
        rejected.reason instanceof CloudWorkspaceConflictError,
    );

    const winner = firstRace.find(
      (result): result is PromiseFulfilledResult<string> =>
        result.status === "fulfilled",
    );
    assert.ok(winner);
    const winningEtag = winner.value;
    const nextEtag = await commitVercelWorkspaceHeadForTests(
      "cabinet-runtime/snapshots/three.json.gz",
      winningEtag,
    );
    assert.notEqual(nextEtag, winningEtag);
    await assert.rejects(
      commitVercelWorkspaceHeadForTests(
        "cabinet-runtime/snapshots/stale.json.gz",
        winningEtag,
      ),
      CloudWorkspaceConflictError,
    );
  } finally {
    await resetVercelWorkspaceForTests();
  }
});

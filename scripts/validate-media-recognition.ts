import assert from "node:assert/strict";

import { analyzeMediaIdentity } from "../src/application/media/media-identity-analysis.ts";

// 这些匿名案例来自真实媒体库中最容易误判的结构。验证器只创建字符串输入，
// 不读取、更不会修改用户的影片、NFO 或 Private Library。
const single = analyzeMediaIdentity({ fileName: "ABC-123.mkv" });
assert.equal(single.filenameCode, "ABC-123");
assert.equal(single.status, "recognized");

const parts = ["DEF-456-CD1.mkv", "DEF-456-CD2.mkv", "DEF-456-CD10.mkv"]
  .map((fileName) => analyzeMediaIdentity({ fileName }));
assert.deepEqual(parts.map((item) => item.part?.index), [1, 2, 10]);
assert.ok(parts.every((item) => item.filenameCode === "DEF-456"));

const edition = analyzeMediaIdentity({ fileName: "GHI-789-4K-中字.mkv" });
assert.deepEqual(edition.editionTags, ["subtitled", "4k"]);
assert.equal(edition.status, "needs_review");

const conflict = analyzeMediaIdentity({ fileName: "JKL-111.mkv", nfoCode: "MNO-222" });
assert.equal(conflict.status, "identity_conflict");
assert.deepEqual([conflict.filenameCode, conflict.nfoCode], ["JKL-111", "MNO-222"]);

const crossFolderVideo = analyzeMediaIdentity({ fileName: "2025 abc123 匿名片名.mkv", nfoCode: "ABC-123" });
assert.equal(crossFolderVideo.status, "recognized");
assert.deepEqual([crossFolderVideo.filenameCode, crossFolderVideo.nfoCode], ["ABC-123", "ABC-123"]);

const broken = analyzeMediaIdentity({ fileName: "unknown-video.mkv" });
assert.equal(broken.status, "unrecognized");

console.log("媒体身份识别案例通过：single / multipart / editions / conflict / cross-folder / broken");

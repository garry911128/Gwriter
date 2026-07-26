import { describe, expect, it } from "vitest";
import { MemoryLibraryGateway } from "./libraryGateway";

describe("document safety gateway contract", () => {
  it("clears recovery only after a successful authoritative save", async () => {
    const gateway = new MemoryLibraryGateway();
    const work = await gateway.createWork();
    const chapterId = work.chapters[0].id;
    await gateway.writeRecovery(chapterId, "未完成內容");
    expect((await gateway.loadRecovery(chapterId))?.text).toBe("未完成內容");
    await gateway.saveChapter(chapterId, "正式內容");
    expect(await gateway.loadRecovery(chapterId)).toBeNull();
  });

  it("keeps the pre-restore text as another immutable version", async () => {
    const gateway = new MemoryLibraryGateway();
    const work = await gateway.createWork();
    const chapterId = work.chapters[0].id;
    await gateway.saveChapter(chapterId, "第一版");
    const first = await gateway.createVersion(chapterId, "初稿");
    await gateway.saveChapter(chapterId, "第二版不可遺失");
    expect((await gateway.restoreVersion(first.id)).text).toBe("第一版");
    expect(await gateway.listVersions(chapterId)).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "before_restore", preview: "第二版不可遺失" }),
      expect.objectContaining({ id: first.id, isImportant: true }),
    ]));
  });
});

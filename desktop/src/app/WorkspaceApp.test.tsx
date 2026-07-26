import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryLibraryGateway } from "../shared/api/libraryGateway";
import { WorkspaceApp } from "./WorkspaceApp";

describe("WorkspaceApp", () => {
  it("lets an author write without first creating cards or scenes", async () => {
    const user = userEvent.setup();
    render(<WorkspaceApp gateway={new MemoryLibraryGateway()} />);
    expect(await screen.findByText("開始第一部作品")).toBeVisible();
    await user.click(screen.getByText("建立作品", { selector: "button.button--primary" }));
    expect(await screen.findByRole("heading", { name: "第一章" })).toBeVisible();
    const editor = screen.getByRole("textbox", { name: "章節正文" });
    await user.type(editor, "故事從這裡開始。");
    expect(editor).toHaveValue("故事從這裡開始。");
  });

  it("creates an optional character card with only a name", async () => {
    const user = userEvent.setup();
    render(<WorkspaceApp gateway={new MemoryLibraryGateway()} />);
    await screen.findByText("開始第一部作品");
    await user.click(screen.getByText("建立作品", { selector: "button.button--primary" }));
    await screen.findByRole("heading", { name: "第一章" });
    await user.click(screen.getByRole("button", { name: "創作卡牌" }));
    await user.click(await screen.findByRole("button", { name: "建立第一張卡牌" }));
    await user.type(screen.getByLabelText(/名稱/), "林清越");
    await user.click(screen.getByRole("button", { name: /^建立$/ }));
    expect(await screen.findByRole("heading", { name: "林清越" })).toBeVisible();
    expect(screen.getByText("確定設定")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "編輯設定" }));
    await user.type(screen.getByLabelText("故事定位"), "主角");
    await user.type(screen.getByLabelText("標籤"), "偵探、第一視角");
    await user.click(screen.getByRole("button", { name: "儲存修改" }));
    expect(await screen.findByText(/偵探、第一視角/)).toBeVisible();
  });

  it("lets the author explicitly connect two cards", async () => {
    const user = userEvent.setup();
    render(<WorkspaceApp gateway={new MemoryLibraryGateway()} />);
    await screen.findByText("開始第一部作品");
    await user.click(screen.getByText("建立作品", { selector: "button.button--primary" }));
    await screen.findByRole("heading", { name: "第一章" });
    await user.click(screen.getByRole("button", { name: "創作卡牌" }));

    for (const name of ["阿黎", "沈川"]) {
      await user.click(screen.getByRole("button", { name: screen.queryByRole("button", { name: "建立第一張卡牌" }) ? "建立第一張卡牌" : "＋ 新增卡牌" }));
      await user.type(screen.getByLabelText(/名稱/), name);
      await user.click(screen.getByRole("button", { name: /^建立$/ }));
    }

    await user.click(screen.getByRole("button", { name: "＋ 新增關係" }));
    await user.type(screen.getByLabelText(/關係名稱/), "師徒");
    await user.click(screen.getByRole("button", { name: "建立關係" }));
    expect(await screen.findByText("師徒 · 目前成立")).toBeVisible();
    expect(screen.getByLabelText("directed")).toBeVisible();
  });

  it("creates an optional relationship graph without changing the manuscript", async () => {
    const user = userEvent.setup();
    render(<WorkspaceApp gateway={new MemoryLibraryGateway()} />);
    await screen.findByText("開始第一部作品");
    await user.click(screen.getByText("建立作品", { selector: "button.button--primary" }));
    await screen.findByRole("heading", { name: "第一章" });
    await user.click(screen.getByRole("button", { name: "關係圖" }));
    await user.click(await screen.findByRole("button", { name: "建立關係圖" }));
    await user.type(screen.getByLabelText("關係圖名稱"), "人物關係");
    await user.click(screen.getByRole("button", { name: "建立圖" }));
    await screen.findByRole("combobox", { name: "目前關係圖" });
    expect(screen.getByRole("option", { name: "人物關係" })).toHaveProperty("selected", true);
  });

  it("keeps an outline idea without requiring a chapter binding", async () => {
    const user = userEvent.setup(); render(<WorkspaceApp gateway={new MemoryLibraryGateway()} />);
    await screen.findByText("開始第一部作品"); await user.click(screen.getByText("建立作品", { selector: "button.button--primary" })); await screen.findByRole("heading", { name: "第一章" });
    await user.click(screen.getByRole("button", { name: "大綱" })); await user.click(await screen.findByRole("button", { name: "建立第一個規劃節點" }));
    await user.type(screen.getByLabelText(/標題/), "主角發現密室"); await user.type(screen.getByLabelText("目的"), "揭露第一條線索"); await user.click(screen.getByRole("button", { name: "建立節點" }));
    expect(await screen.findByText("主角發現密室")).toBeVisible(); expect(screen.getByText(/尚未綁定/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "轉成章節" }));
    expect(await screen.findByText(/已綁定正文/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "作品" }));
    await user.click(screen.getByRole("button", { name: /主角發現密室/ }));
    expect(await screen.findByRole("heading", { name: "主角發現密室" })).toBeVisible();
  });

  it("shows the real local storage location and creates a safety backup", async () => {
    const user = userEvent.setup(); render(<WorkspaceApp gateway={new MemoryLibraryGateway()} />);
    await user.click(screen.getByRole("button", { name: "設定" }));
    expect(await screen.findByText(/workspace\.sqlite3/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "立即備份" }));
    expect(await screen.findByText(/格式 v1/)).toBeVisible();
    expect(screen.getByText(/gwriter-safety-v1-/)).toBeVisible();
  });
});

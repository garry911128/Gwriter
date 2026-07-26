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
});

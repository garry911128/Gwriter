import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Eye, Save, Text, AlignLeft } from "lucide-react";

export default function NovelEditor() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setContent(value);
    setWordCount(value.trim() ? value.split(/\s+/).length : 0);
  };

  const saveContent = () => {
    console.log("Saving:", { title, content });
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-xl w-full max-w-4xl mx-auto shadow-lg border border-gray-700">
      {/* Header - 標題 & 按鈕 */}
      <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold flex-grow">Novel Editor</h2>
      <div className="flex gap-2">
        <Button className="bg-gray-700 hover:bg-gray-600 flex items-center gap-1 border border-gray-500 shadow-md">
          <Eye size={16} /> Preview
        </Button>
        <Button
          onClick={saveContent}
          className="bg-purple-700 hover:bg-purple-800 flex items-center gap-1 border border-gray-500 shadow-md"
        >
          <Save size={16} /> Save
        </Button>
      </div>
    </div>



      {/* Main Content */}
      <div className="flex gap-6">
        {/* 左側工具列 */}
        <div className="w-1/4 flex flex-col gap-3">
          {/* 文字樣式選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 flex items-center gap-1 w-full">
              <Text size={16} /> Text Style
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-700 text-white border border-gray-600 rounded-lg">
              <DropdownMenuItem>Bold</DropdownMenuItem>
              <DropdownMenuItem>Italic</DropdownMenuItem>
              <DropdownMenuItem>Underline</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 格式選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 flex items-center gap-1 w-full">
              <AlignLeft size={16} /> Formatting
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-700 text-white border border-gray-600 rounded-lg">
              <DropdownMenuItem>Left Align</DropdownMenuItem>
              <DropdownMenuItem>Center Align</DropdownMenuItem>
              <DropdownMenuItem>Right Align</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 右側書寫區 */}
        <div className="w-3/4">
          {/* 章節標題輸入框 */}
          <input
            type="text"
            placeholder="Chapter Title"
            className="w-full p-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 font-semibold"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* 內容輸入框（紅色邊框錯誤狀態） */}
          <textarea
            placeholder="Start writing your story..."
            className="w-full p-3 bg-gray-800 border border-red-500 rounded-lg h-60 text-gray-300"
            value={content}
            onChange={handleContentChange}
          />
        </div>
      </div>

      {/* 底部資訊 */}
      <div className="flex justify-between items-center text-sm text-gray-400 mt-3">
        <span>Words: {wordCount}</span>
        <span>Last saved: Just now</span>
      </div>
    </div>
  );
}

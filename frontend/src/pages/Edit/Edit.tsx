import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
    <div className="p-6 bg-gray-900 text-white rounded-xl w-full max-w-3xl mx-auto shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Novel Editor</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-1">
            <Eye size={16} /> Preview
          </Button>
          <Button onClick={saveContent} className="bg-purple-600 hover:bg-purple-700 flex items-center gap-1">
            <Save size={16} /> Save
          </Button>
        </div>
      </div>
      <div className="flex gap-4 mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700 flex items-center gap-1">
            <Text size={16} /> Text Style
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 text-white border border-gray-700 rounded-lg">
            <DropdownMenuItem>Bold</DropdownMenuItem>
            <DropdownMenuItem>Italic</DropdownMenuItem>
            <DropdownMenuItem>Underline</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700 flex items-center gap-1">
            <AlignLeft size={16} /> Formatting
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 text-white border border-gray-700 rounded-lg">
            <DropdownMenuItem>Left Align</DropdownMenuItem>
            <DropdownMenuItem>Center Align</DropdownMenuItem>
            <DropdownMenuItem>Right Align</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <input
        type="text"
        placeholder="Chapter Title"
        className="w-full p-2 mb-3 bg-gray-800 border border-gray-700 rounded-lg"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="Write your novel here..."
        className="w-full p-2 mb-3 bg-gray-800 border border-gray-700 rounded-lg h-60"
        value={content}
        onChange={handleContentChange}
      />
      <div className="flex justify-between items-center text-sm text-gray-400">
        <span>Words: {wordCount}</span>
        <Button onClick={saveContent} className="bg-purple-600 hover:bg-purple-700">
          Save
        </Button>
      </div>
    </div>
  );
}

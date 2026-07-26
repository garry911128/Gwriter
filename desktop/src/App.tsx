import { useMemo } from "react";
import { WorkspaceApp } from "./app/WorkspaceApp";
import { createLibraryGateway } from "./shared/api/libraryGateway";
import "./App.css";

export default function App() {
  const gateway = useMemo(() => createLibraryGateway(), []);
  return <WorkspaceApp gateway={gateway} />;
}

import { ToolRegistry } from '../registry.js';
import { readFileTool } from './readFile.js';
import { listFilesTool } from './listFiles.js';
import { searchTextTool } from './searchText.js';
import { writeFileTool } from './writeFile.js';
import { patchFileTool } from './patchFile.js';
import { runCommandTool } from './runCommand.js';
import { gitStatusTool } from './gitStatus.js';
import { workspaceInfoTool } from './workspaceInfo.js';
import { gitDiffTool } from './gitDiff.js';
import { verifyTool, discoverTestsTool } from './verificationTool.js';
import { createCheckpointTool, listCheckpointsTool, rollbackCheckpointTool } from './checkpoint.js';
import { diffPreviewTool, applyHunksTool, patchHistoryTool } from './diffReview.js';
import type { AnyTool } from '../types.js';

export {
  readFileTool,
  listFilesTool,
  searchTextTool,
  writeFileTool,
  patchFileTool,
  runCommandTool,
  gitStatusTool,
  workspaceInfoTool,
  gitDiffTool,
  verifyTool,
  discoverTestsTool,
  createCheckpointTool,
  listCheckpointsTool,
  rollbackCheckpointTool,
  diffPreviewTool,
  applyHunksTool,
  patchHistoryTool,
};

/** Every Phase 1 tool, in the order they are advertised to the model. */
export const defaultTools: AnyTool[] = [
  workspaceInfoTool,
  listFilesTool,
  readFileTool,
  searchTextTool,
  gitStatusTool,
  gitDiffTool,
  patchFileTool,
  writeFileTool,
  runCommandTool,
  verifyTool,
  discoverTestsTool,
  createCheckpointTool,
  listCheckpointsTool,
  rollbackCheckpointTool,
  diffPreviewTool,
  patchHistoryTool,
];

// Phase 2 full toolkit includes hunk-level diff controls
export const phase2Tools: AnyTool[] = [...defaultTools, applyHunksTool];

export function createDefaultRegistry(): ToolRegistry {
  return new ToolRegistry().registerAll(defaultTools);
}

export function createPhase2Registry(): ToolRegistry {
  return new ToolRegistry().registerAll(phase2Tools);
}

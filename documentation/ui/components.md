# UI Components

## Reusable Components (`@cluster/ui-kit`)

These components are in `packages/ui-kit/src/` and imported by renderer pages.

### DiffView (`DiffView.tsx`)

Renders a unified diff string with syntax coloring.

**Props:**
```typescript
interface DiffViewProps {
  diff: string;           // Unified diff text
  path?: string;          // File path (shown as header)
  additions?: number;     // +N count
  deletions?: number;     // -M count
  kind?: 'create' | 'update' | 'delete';
  compact?: boolean;      // If true, show collapsed
}
```

**Rendering:**
- `@@` hunk headers in gray
- `+` lines in green (`#16a34a`)
- `-` lines in red (`#dc2626`)
- `---`/`+++` headers in muted gray
- Line numbers in dim gray
- Scrollable container with overflow handling

---

### Collapsible (`Collapsible.tsx`)

Generic expandable panel.

**Props:**
```typescript
interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
```

**Behavior:**
- Click header to toggle
- Chevron rotates 180° on open
- Smooth height transition via CSS max-height hack

---

### SplitPane (`SplitPane.tsx`)

Draggable split between two panels.

**Props:**
```typescript
interface SplitPaneProps {
  initialRatio?: number;    // Default: 0.5
  minRatio?: number;        // Default: 0.2
  orientation?: 'horizontal' | 'vertical';
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}
```

**Behavior:**
- Drag handle in the center
- Updates ratio on mouse move
- Snap to min/max ratios
- Persists ratio via localStorage key (optional)

---

### TaskItem (`TaskItem.tsx`)

Single task card for the tasks page.

**Props:**
```typescript
interface TaskItemProps {
  task: TaskItem;           // From useAgent.TaskItem type
  expanded?: boolean;
  onToggle?: () => void;
}
```

**Display:**
- Role badge (color-coded by agent role)
- Title with truncation
- Status dot + label
- Dependency indicators (arrows to parent/children)
- Complexity star rating (1-5)

---

## Renderer Components (`apps/electron/src/renderer/components/`)

### Sidebar (`Sidebar.tsx`)

Left navigation rail (260px wide).

**Sections:**
1. **Brand header** — Cluster logo (◈), workspace name, new session button
2. **Navigation** — 10 nav items with labels, shortcut hints, badges
3. **Session list** — Up to 8 recent sessions with status dots
4. **Status footer** — Agent running indicator, role badges, model name

**Styling:** Dark surface `#0c0c0f`, border `#232326`, active item white bg with black text.

---

### TopBar (`TopBar.tsx`)

36px tall drag-region header.

**Items:**
- Workspace name (clickable → opens workspace switcher)
- Current page title
- Model badge (cyan)
- Session title (truncated)
- New Session button
- Checkpoint button (Ctrl+G hint)
- Command Palette button (Ctrl+K hint)

**Traffic lights** (macOS): Custom colored dots matching the dark theme.

---

### Composer (`Composer.tsx`)

Input area at the bottom of the workspace page.

**Props:**
```typescript
interface ComposerProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
}
```

**Behavior:**
- Auto-resizing textarea (grows with content)
- `Enter` submits, `Shift+Enter` adds newline
- Placeholder cycles through hints when idle vs busy
- Focus management: auto-focuses on session select
- Slash command detection: starts with `/` → opens quick actions

---

### DiffViewer (`DiffViewer.tsx`)

Wrapper around ui-kit DiffView with session-level controls.

**Features:**
- Shows all edits for a session or a specific tool call
- Rollback button per edit (opens checkpoint selector)
- Expand/collapse each diff
- Line count summary

---

### MemoryCard (`MemoryCard.tsx`)

Single memory entry card for the Memory page.

**Props:**
```typescript
interface MemoryCardProps {
  memory: MemoryEntry;
  onPin?: (id: string, pinned: boolean) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string, archived: boolean) => void;
}
```

**Display:**
- Category badge (color by category)
- Title + summary
- Importance bar (visual indicator 0–1)
- Tags chip row
- Pin/archive/delete action buttons
- Last accessed timestamp

---

### TaskCards (`TaskCards.tsx`)

Grid of agent role cards shown in the workspace page during multi-agent execution.

**Each card shows:**
- Role name and avatar
- Progress bar (done/total)
- Current task title
- Status glow (amber = running, green = done, red = failed)

---

### WorkflowCard (`WorkflowCard.tsx`)

Compact card showing a single workflow step from the plan.

**Props:**
```typescript
interface WorkflowCardProps {
  step: PlanStep;
  index: number;
}
```

---

### CommandPalette (`CommandPalette.tsx`)

Global command palette modal (Ctrl+K).

**Props:**
```typescript
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  items: PaletteItem[];
}

interface PaletteItem {
  id: string;
  label: string;
  detail?: string;
  hotkey?: string;
}
```

**Features:**
- Fuzzy search filtering
- Keyboard navigation (↑/↓ arrows, Enter to select)
- Grouped sections: Navigation, Actions, Recent Workspaces, Recent Sessions
- Escape to close

---

### WorkspaceSwitcherModal (`WorkspaceSwitcherModal.tsx`)

Modal for switching between workspaces.

**Features:**
- Path input field
- "Browse" button (opens native directory dialog)
- Recent workspaces list (from localStorage, max 15)
- Remove from recent button
- Click to switch immediately

---

## Styles (`styles/global.css`)

Tailwind CSS with custom extensions:

```css
/* Base */
@layer base {
  body {
    background: #07070a;
    color: #f4f4f5;
    font-family: 'Inter', system-ui, sans-serif;
  }
  code, pre {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

/* Grid background pattern */
.grid-bg {
  background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 32px 32px;
}

/* Glow effects */
.glow-emerald { box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
.glow-amber { box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); }
.glow-violet { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
```

---

## Page-Specific Component Usage

| Page | Key Components Used |
|------|-------------------|
| SessionsPage | None (custom-built) |
| WorkspacePage | Composer, MessageTimeline (inline), PlanView (inline), ConfirmDialog (inline) |
| TasksPage | TaskCards, WorkflowCard |
| DiffPage | DiffViewer |
| LogsPage | ActivityFeed (inline), LiveOutputPanel (inline) |
| BackgroundPage | JobCard (inline) |
| CheckpointsPage | CheckpointCard (inline) |
| MemoryPage | MemoryCard |
| ProviderPage | ConfigForm (inline), TestButton (inline) |
| SettingsPage | WorkspaceInfo (inline), DiagPanel (inline) |

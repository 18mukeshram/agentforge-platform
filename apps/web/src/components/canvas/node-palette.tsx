"use client";

/**
 * Node palette component.
 * Displays available node types that can be dragged onto the canvas.
 */

import { useUiStore } from "@/stores";
import { NODE_TYPE_META } from "./nodes/types";
import { AgentIcon, ToolIcon, InputIcon, OutputIcon } from "./nodes/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/types";

interface NodePaletteProps {
  className?: string;
}

export function NodePalette({ className }: NodePaletteProps) {
  const { nodePaletteOpen } = useUiStore();

  if (!nodePaletteOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute left-4 top-16 z-10 w-56",
        "rounded-lg border bg-background/95 shadow-lg backdrop-blur",
        className
      )}
    >
      <div className="border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Node Palette</h3>
        <p className="text-xs text-muted-foreground">Drag nodes to canvas</p>
      </div>

      <ScrollArea className="h-[280px]">
        <div className="space-y-1 p-2">
          {(Object.keys(NODE_TYPE_META) as NodeType[]).map((type) => (
            <NodePaletteItem key={type} type={type} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface NodePaletteItemProps {
  type: NodeType;
}

function NodePaletteItem({ type }: NodePaletteItemProps) {
  const meta = NODE_TYPE_META[type];
  const Icon = getIconForType(type);

  // Handle drag start - store node type in dataTransfer
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/reactflow-nodetype", type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "flex cursor-grab items-center gap-3 rounded-md p-2",
        "border border-transparent",
        "transition-colors hover:border-border hover:bg-accent",
        "active:cursor-grabbing"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          meta.color,
          "text-white"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="text-sm font-medium">{meta.label}</div>
        <div className="truncate text-xs text-muted-foreground">
          {meta.description}
        </div>
      </div>
    </div>
  );
}

// Get icon component for node type
function getIconForType(type: NodeType) {
  switch (type) {
    case "agent":
      return AgentIcon;
    case "tool":
      return ToolIcon;
    case "input":
      return InputIcon;
    case "output":
      return OutputIcon;
    default:
      return AgentIcon;
  }
}

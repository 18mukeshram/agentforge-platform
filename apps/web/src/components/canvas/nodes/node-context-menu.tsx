"use client";

/**
 * Context menu for nodes.
 */

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCanvasStore, useWorkflowStore } from "@/stores";
import { CopyIcon, TrashIcon, SettingsIcon, PlayIcon } from "./icons";

interface NodeContextMenuProps {
  nodeId: string;
  children: React.ReactNode;
  onConfigure?: () => void;
}

export function NodeContextMenu({
  nodeId,
  children,
  onConfigure,
}: NodeContextMenuProps) {
  const { removeNode, selectNode, copySelected } = useCanvasStore();
  const { removeNode: removeWorkflowNode } = useWorkflowStore();

  const handleDelete = () => {
    removeNode(nodeId);
    removeWorkflowNode(nodeId);
  };

  const handleDuplicate = () => {
    selectNode(nodeId);
    copySelected();
    // Paste will be triggered separately
  };

  const handleConfigure = () => {
    selectNode(nodeId);
    onConfigure?.();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleConfigure}>
          <SettingsIcon className="mr-2" />
          Configure
          <ContextMenuShortcut>⌘E</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate}>
          <CopyIcon className="mr-2" />
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <TrashIcon className="mr-2" />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

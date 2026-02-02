"use client";

/**
 * Node configuration popover for quick edits.
 */

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanvasStore, useWorkflowStore } from "@/stores";
import { SettingsIcon } from "./icons";
import type { NodeType } from "@/types";

interface NodeConfigPopoverProps {
  nodeId: string;
  nodeType: NodeType;
  label: string;
  config: Record<string, unknown>;
  children?: React.ReactNode;
}

export function NodeConfigPopover({
  nodeId,
  nodeType,
  label,
  config,
  children,
}: NodeConfigPopoverProps) {
  const [open, setOpen] = useState(false);
  const [localLabel, setLocalLabel] = useState(label);
  const [localConfig, setLocalConfig] = useState(config);

  const { updateNode } = useCanvasStore();
  const { updateNode: updateWorkflowNode } = useWorkflowStore();

  const handleSave = () => {
    // Update canvas node
    updateNode(nodeId, {
      data: {
        label: localLabel,
        type: nodeType,
        config: { ...localConfig },
      },
    });

    // Update workflow node
    updateWorkflowNode(nodeId, {
      label: localLabel,
      config: { ...localConfig },
    });

    setOpen(false);
  };

  const handleCancel = () => {
    setLocalLabel(label);
    setLocalConfig(config);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <SettingsIcon className="h-3 w-3" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Configure Node</h4>
            <p className="text-sm text-muted-foreground">
              Edit the node properties.
            </p>
          </div>

          <div className="space-y-3">
            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="node-label">Label</Label>
              <Input
                id="node-label"
                value={localLabel}
                onChange={(e) => setLocalLabel(e.target.value)}
                placeholder="Node label"
              />
            </div>

            {/* Agent-specific config */}
            {nodeType === "agent" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-id">Agent ID</Label>
                  <Input
                    id="agent-id"
                    value={(localConfig.agentId as string) || ""}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        agentId: e.target.value,
                      })
                    }
                    placeholder="e.g., gpt-4-agent"
                  />
                </div>
              </>
            )}

            {/* Tool-specific config */}
            {nodeType === "tool" && (
              <div className="space-y-1.5">
                <Label htmlFor="tool-id">Tool ID</Label>
                <Input
                  id="tool-id"
                  value={
                    ((localConfig.parameters as Record<string, unknown>)
                      ?.toolId as string) || ""
                  }
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      parameters: {
                        ...(localConfig.parameters as Record<string, unknown>),
                        toolId: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g., web-search"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

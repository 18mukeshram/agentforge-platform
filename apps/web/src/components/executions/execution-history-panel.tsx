"use client";

/**
 * Execution history panel component.
 * Sidebar panel showing execution history for the current workflow.
 */

import { useRouter } from "next/navigation";
import { useWorkflowStore, useUiStore } from "@/stores";
import { ExecutionHistoryList } from "./execution-history-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExecutionHistoryPanelProps {
  className?: string;
}

export function ExecutionHistoryPanel({ className }: ExecutionHistoryPanelProps) {
  const router = useRouter();
  const { workflow } = useWorkflowStore();
  const { executionHistoryOpen, toggleExecutionHistory } = useUiStore();

  const handleSelectExecution = (executionId: string) => {
    router.push(`/executions/${executionId}`);
  };

  if (!executionHistoryOpen || !workflow) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute right-4 top-16 z-10 w-72",
        "rounded-lg border bg-background/95 shadow-lg backdrop-blur",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Execution History</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleExecutionHistory}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Execution List */}
      <div className="max-h-80">
        <ExecutionHistoryList
          workflowId={workflow.id}
          onSelectExecution={handleSelectExecution}
        />
      </div>
    </div>
  );
}

// X icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

"use client";

/**
 * Canvas toolbar component.
 * Provides action buttons for canvas operations like zoom, fit, selection, and clipboard.
 */

import { useReactFlow } from "reactflow";
import { useCanvasStore, useUiStore, useWorkflowStore, useExecutionStore } from "@/stores";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  className?: string;
  onSave?: () => void;
  onValidate?: () => void;
  onRun?: () => void;
  isReadOnly?: boolean;  // Phase 13.4: Read-only mode
}

export function Toolbar({ className, onSave, onValidate, onRun, isReadOnly = false }: ToolbarProps) {
  const reactFlow = useReactFlow();

  // Canvas store actions
  const { selectAll, deleteSelected, copySelected, paste, selectedNodeIds, selectedEdgeIds } =
    useCanvasStore();

  // Workflow store state
  const { isDirty, isSaving, isValidating, workflow } = useWorkflowStore();

  // Execution store state
  const { isExecuting } = useExecutionStore();

  // UI store actions
  const { nodePaletteOpen, toggleNodePalette, executionHistoryOpen, toggleExecutionHistory } = useUiStore();

  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
  const canSave = !!workflow && isDirty && !isSaving && !isReadOnly;
  const canValidate = !!workflow && !isValidating;
  const canRun = !!workflow && workflow.status === "valid" && !isExecuting && !isReadOnly;

  // Zoom handlers
  const handleZoomIn = () => {
    reactFlow.zoomIn({ duration: 200 });
  };

  const handleZoomOut = () => {
    reactFlow.zoomOut({ duration: 200 });
  };

  const handleFitView = () => {
    reactFlow.fitView({ padding: 0.2, duration: 200 });
  };

  const handleResetZoom = () => {
    reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "absolute left-1/2 top-4 z-10 -translate-x-1/2",
          "flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur",
          className
        )}
      >
        {/* Node Palette Toggle */}
        <ToolbarButton
          tooltip={nodePaletteOpen ? "Hide Node Palette" : "Show Node Palette"}
          onClick={toggleNodePalette}
          active={nodePaletteOpen}
        >
          <PanelLeftIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Zoom Controls */}
        <ToolbarButton tooltip="Zoom In" onClick={handleZoomIn}>
          <ZoomInIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton tooltip="Zoom Out" onClick={handleZoomOut}>
          <ZoomOutIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton tooltip="Fit View" onClick={handleFitView}>
          <MaximizeIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton tooltip="Reset Zoom" onClick={handleResetZoom}>
          <LocateFixedIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Selection Controls */}
        <ToolbarButton tooltip="Select All" onClick={selectAll}>
          <BoxSelectIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          tooltip="Delete Selected"
          onClick={deleteSelected}
          disabled={!hasSelection}
        >
          <TrashIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Clipboard Controls */}
        <ToolbarButton
          tooltip="Copy"
          onClick={copySelected}
          disabled={!hasSelection}
        >
          <CopyIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton tooltip="Paste" onClick={paste}>
          <ClipboardIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Save Controls */}
        {onSave && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
              tooltip={
                isSaving
                  ? "Saving..."
                  : isDirty
                    ? "Save Changes (Ctrl+S)"
                    : "All changes saved"
              }
              onClick={onSave}
              disabled={!canSave}
            >
              {isSaving ? (
                <LoaderIcon className="h-4 w-4" />
              ) : isDirty ? (
                <SaveIcon className="h-4 w-4" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
              )}
            </ToolbarButton>
          </>
        )}

        {/* Validate Controls */}
        {onValidate && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
              tooltip={isValidating ? "Validating..." : "Validate Workflow"}
              onClick={onValidate}
              disabled={!canValidate}
            >
              {isValidating ? (
                <LoaderIcon className="h-4 w-4" />
              ) : (
                <ShieldCheckIcon className="h-4 w-4" />
              )}
            </ToolbarButton>
          </>
        )}

        {/* Run Controls */}
        {onRun && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
              tooltip={
                isExecuting
                  ? "Execution in progress..."
                  : workflow?.status !== "valid"
                    ? "Validate workflow first"
                    : "Run Workflow"
              }
              onClick={onRun}
              disabled={!canRun}
            >
              {isExecuting ? (
                <LoaderIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </ToolbarButton>
          </>
        )}

        {/* History Toggle */}
        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          tooltip={executionHistoryOpen ? "Hide History" : "Show History"}
          onClick={toggleExecutionHistory}
          active={executionHistoryOpen}
        >
          <HistoryIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </TooltipProvider>
  );
}

// Toolbar button with tooltip
interface ToolbarButtonProps {
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function ToolbarButton({
  tooltip,
  onClick,
  disabled,
  active,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// Icon components
function PanelLeftIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

function ZoomInIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  );
}

function MaximizeIcon({ className }: { className?: string }) {
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
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function LocateFixedIcon({ className }: { className?: string }) {
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
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BoxSelectIcon({ className }: { className?: string }) {
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
      <path d="M5 3a2 2 0 0 0-2 2" />
      <path d="M19 3a2 2 0 0 1 2 2" />
      <path d="M21 19a2 2 0 0 1-2 2" />
      <path d="M5 21a2 2 0 0 1-2-2" />
      <path d="M9 3h1" />
      <path d="M9 21h1" />
      <path d="M14 3h1" />
      <path d="M14 21h1" />
      <path d="M3 9v1" />
      <path d="M21 9v1" />
      <path d="M3 14v1" />
      <path d="M21 14v1" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
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
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
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
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("animate-spin", className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
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
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
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
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

"use client";

/**
 * Execution History List page.
 * Shows all executions with pagination and status filtering.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAllExecutions } from "@/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export default function ExecutionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useAllExecutions({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const executions = data?.items || [];
  const hasNext = data?.nextCursor !== null;
  const hasPrev = page > 0;

  const handleNext = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const handlePrev = useCallback(() => {
    if (hasPrev) setPage((p) => p - 1);
  }, [hasPrev]);

  const handleRowClick = useCallback((id: string) => {
    router.push(`/executions/${id}`);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Failed to load executions</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Execution History</h1>
          <p className="text-sm text-muted-foreground">
            View all workflow executions
          </p>
        </div>
      </div>

      {/* Executions Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Execution ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Workflow
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Started
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {executions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No executions found
                </td>
              </tr>
            ) : (
              executions.map((execution) => (
                <tr
                  key={execution.id}
                  className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleRowClick(execution.id)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm">{execution.id.slice(0, 12)}...</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {execution.workflowId.slice(0, 12)}...
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={execution.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatTimestamp(execution.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {calculateDuration(execution.createdAt, execution.completedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page + 1}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!hasPrev}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!hasNext}
          >
            Next
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        status === "completed" && "bg-green-100 text-green-800",
        status === "running" && "bg-blue-100 text-blue-800",
        status === "failed" && "bg-red-100 text-red-800",
        status === "pending" && "bg-yellow-100 text-yellow-800",
        status === "cancelled" && "bg-gray-100 text-gray-800"
      )}
    >
      {status}
    </span>
  );
}

// Utility Functions
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function calculateDuration(startTime: string, endTime: string | null): string {
  if (!endTime) return "In progress";
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${(durationMs / 60000).toFixed(1)}m`;
}

// Icons
function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useWorkflows } from "@/hooks";

export default function WorkflowsPage() {
  const { data, isLoading, error } = useWorkflows();
  const workflows = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading workflows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-destructive">Failed to load workflows: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Manage your AI agent workflows.
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">New Workflow</Link>
        </Button>
      </div>

      {/* Workflow Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <Link key={workflow.id} href={`/workflows/${workflow.id}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {workflow.name}
                </CardTitle>
                <Badge
                  variant={
                    workflow.status === "valid"
                      ? "default"
                      : workflow.status === "invalid"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {workflow.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{workflow.nodeCount} nodes</span>
                  <span>
                    {new Date(workflow.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {workflows.length === 0 && (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground">No workflows yet.</p>
            <Button variant="link" asChild>
              <Link href="/workflows/new">Create your first workflow</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

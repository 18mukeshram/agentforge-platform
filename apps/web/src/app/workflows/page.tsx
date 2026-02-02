import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Mock data for now
const mockWorkflows = [
  {
    id: "workflow-1",
    name: "Customer Support Bot",
    status: "valid" as const,
    updatedAt: "2024-01-15T10:30:00Z",
    nodeCount: 5,
  },
  {
    id: "workflow-2",
    name: "Data Processing Pipeline",
    status: "draft" as const,
    updatedAt: "2024-01-14T15:45:00Z",
    nodeCount: 8,
  },
  {
    id: "workflow-3",
    name: "RAG Assistant",
    status: "invalid" as const,
    updatedAt: "2024-01-13T09:20:00Z",
    nodeCount: 3,
  },
];

export default function WorkflowsPage() {
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
        {mockWorkflows.map((workflow) => (
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

      {mockWorkflows.length === 0 && (
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

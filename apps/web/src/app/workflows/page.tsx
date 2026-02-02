import { Button } from "@/components/ui/button";
import Link from "next/link";

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

      {/* Placeholder for workflow list */}
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <p className="text-muted-foreground">No workflows yet.</p>
          <Button variant="link" asChild>
            <Link href="/workflows/new">Create your first workflow</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

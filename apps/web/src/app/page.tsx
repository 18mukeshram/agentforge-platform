import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to AgentForge. Build and manage your AI workflows.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Workflows"
          value="12"
          description="+2 from last week"
        />
        <StatsCard
          title="Active Executions"
          value="3"
          description="Running now"
        />
        <StatsCard
          title="Completed Today"
          value="24"
          description="+12% from yesterday"
        />
        <StatsCard
          title="Available Agents"
          value="8"
          description="Ready to use"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Create Workflow</CardTitle>
            <CardDescription>
              Design a new AI agent workflow with our visual builder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/workflows/new">New Workflow</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View Executions</CardTitle>
            <CardDescription>
              Monitor running workflows and review past executions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/executions">View All</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Browse Agents</CardTitle>
            <CardDescription>
              Explore available AI agents and tools for your workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/agents">Browse</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">Browse and manage AI agents.</p>
      </div>

      {/* Placeholder for agents list */}
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground">Agents will appear here.</p>
      </div>
    </div>
  );
}

export default function ExecutionsPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executions</h1>
        <p className="text-muted-foreground">
          Monitor and review workflow executions.
        </p>
      </div>

      {/* Placeholder for executions list */}
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground">No executions yet.</p>
      </div>
    </div>
  );
}

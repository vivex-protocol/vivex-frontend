export const defaultSpan = (testId: string) => <span data-testid={testId} className="hidden" />

export const defaultDiv = (...testIds: string[]) => (
  <div>
    {testIds.map((testId) => (
      <span key={testId} data-testid={testId} className="hidden" />
    ))}
  </div>
)

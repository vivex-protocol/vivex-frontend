export const BlurryOverlay: React.FC<{
    children: React.ReactNode
    isVisible: boolean
    testId?: string
  }> = ({ children, isVisible, testId }) => (
    <div data-testid={testId} className={isVisible ? "blur-sm pointer-events-none" : ""}>
      {children}
    </div>
  )
  
  export const withBlurryOverlay =
    <P extends {}>(project: (props: P) => boolean): React.FC<{ children: React.ReactNode } & P> =>
    ({ children, ...props }) =>
      <BlurryOverlay isVisible={project(props as any)}>{children}</BlurryOverlay>
  
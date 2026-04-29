// Reconstruction error types for structured error handling

export class ReconstructionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ReconstructionError'
  }
}

export class DockerExecutionError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message)
    this.name = 'DockerExecutionError'
  }
}

export class InputValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly constraint?: string
  ) {
    super(message)
    this.name = 'InputValidationError'
  }
}

export class CacheError extends Error {
  constructor(
    message: string,
    public readonly operation: 'get' | 'set' | 'delete',
    public readonly key?: string
  ) {
    super(message)
    this.name = 'CacheError'
  }
}

export class QueueError extends Error {
  constructor(
    message: string,
    public readonly operation: 'push' | 'drain' | 'isBusy',
    public readonly taskId?: string
  ) {
    super(message)
    this.name = 'QueueError'
  }
}

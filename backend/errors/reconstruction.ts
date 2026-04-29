// 再構築パイプラインで使う構造化エラー

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

export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly originalName?: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

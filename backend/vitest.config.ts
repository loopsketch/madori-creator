import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '_legacy/**'],
    // テスト中は ONNX を介在させない (モデル DL とネイティブ推論を回避)
    env: { DEPTH_ESTIMATOR: 'mock' },
  },
})

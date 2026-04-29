// Declare globals for vitest
export {};

declare global {
  interface Window {
    describe: typeof describe;
    it: typeof it;
    test: typeof test;
  }
}

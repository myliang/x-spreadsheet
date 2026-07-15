declare module 'less' {
  interface RenderOptions {
    readonly filename?: string;
  }

  interface RenderOutput {
    readonly css: string;
  }

  const less: {
    render(source: string, options?: RenderOptions): Promise<RenderOutput>;
  };

  export default less;
}

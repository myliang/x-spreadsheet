export class ClipboardHarness {
  text = '';
  readError: unknown;
  writeError: unknown;
  reads = 0;
  writes = 0;

  readonly port = {
    readText: async (): Promise<string> => {
      this.reads += 1;
      if (this.readError !== undefined) throw this.readError;
      return this.text;
    },
    writeText: async (value: string): Promise<void> => {
      this.writes += 1;
      if (this.writeError !== undefined) throw this.writeError;
      this.text = value;
    },
  };
}

export class DataTransferHarness {
  private readonly values = new Map<string, string>();
  clears = 0;

  clearData(): void {
    this.clears += 1;
    this.values.clear();
  }

  getData(type: string): string {
    return this.values.get(type) ?? '';
  }

  setData(type: string, value: string): void {
    this.values.set(type, value);
  }
}


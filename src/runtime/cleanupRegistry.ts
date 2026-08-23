export type Cleanup = () => void;

export class CleanupRegistry {
  readonly #cleanups: Cleanup[] = [];
  #disposed = false;

  get isDisposed(): boolean {
    return this.#disposed;
  }

  add(cleanup: Cleanup): Cleanup {
    if (this.#disposed) {
      cleanup();
      return () => undefined;
    }

    this.#cleanups.push(cleanup);
    let registered = true;

    return () => {
      if (!registered) return;
      registered = false;
      const index = this.#cleanups.lastIndexOf(cleanup);
      if (index >= 0) this.#cleanups.splice(index, 1);
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const errors: unknown[] = [];
    for (const cleanup of this.#cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more DOCode cleanup operations failed.');
    }
  }
}

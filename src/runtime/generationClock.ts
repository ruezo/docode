export class GenerationClock {
  #generation = 0;

  capture(): number {
    return this.#generation;
  }

  invalidate(): number {
    this.#generation += 1;
    return this.#generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.#generation;
  }
}

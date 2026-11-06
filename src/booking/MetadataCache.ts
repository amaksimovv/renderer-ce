export class MetadataCache<T extends { id: number }> {
  private values = new Map<number, T>();
  private allDirty = true;
  private dirty = new Set<number>();
  constructor(private build: () => T[]) {}
  get(id: number): T | null {
    if (this.allDirty) this.refresh();
    else if (this.dirty.has(id)) this.rebuild(id);
    return this.values.get(id) ?? null;
  }
  all(): T[] {
    if (this.allDirty) this.refresh();
    else for (const id of this.dirty) this.rebuild(id);
    return [...this.values.values()];
  }
  private rebuild(id: number): void {
    const value = this.build().find((item) => item.id === id);
    if (value) this.values.set(id, value);
    else this.values.delete(id);
    this.dirty.delete(id);
  }
  invalidate(id?: number): void {
    if (id !== undefined) this.dirty.add(id);
    else {
      this.allDirty = true;
      this.dirty.clear();
    }
  }
  refresh(): void {
    this.values = new Map(this.build().map((value) => [value.id, value]));
    this.allDirty = false;
    this.dirty.clear();
  }
  destroy(): void {
    this.values.clear();
  }
}

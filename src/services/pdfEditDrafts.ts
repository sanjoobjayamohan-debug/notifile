export class PdfEditDrafts<T extends { targetId: string }> {
  private readonly drafts = new Map<string, T>();

  get(targetId: string): T | undefined {
    return this.drafts.get(targetId);
  }

  set(draft: T): void {
    this.drafts.set(draft.targetId, draft);
  }

  delete(targetId: string): void {
    this.drafts.delete(targetId);
  }

  merge(edits: T[]): T[] {
    const merged = new Map(edits.map((edit) => [edit.targetId, edit]));
    this.drafts.forEach((edit, targetId) => merged.set(targetId, edit));
    return [...merged.values()];
  }
}

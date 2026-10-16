import { Injectable, signal } from '@angular/core';

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Text the user has to type before the action can be confirmed, e.g. the name of a graph. */
  confirmText?: string;
};

type PendingConfirm = ConfirmRequest & { resolve: (confirmed: boolean) => void };

/** Asks the user to confirm an action. The dialog is rendered by `ConfirmDialogComponent`. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | undefined>(undefined);
  public readonly pending = this._pending.asReadonly();

  public confirm(request: ConfirmRequest): Promise<boolean> {
    this._pending()?.resolve(false);
    return new Promise(resolve => this._pending.set({ ...request, resolve }));
  }

  public resolve(confirmed: boolean) {
    const pending = this._pending();
    if (!pending) return;
    this._pending.set(undefined);
    pending.resolve(confirmed);
  }
}

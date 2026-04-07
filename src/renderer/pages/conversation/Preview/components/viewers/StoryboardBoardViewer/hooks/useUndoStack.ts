/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Shot } from '@/common/types/videoCreation';
import { useCallback, useRef } from 'react';

type UndoEntry = {
  shotId: string;
  before: Partial<Shot>;
  label: string;
};

type UpdateShotFn = (shotId: string, updates: Partial<Shot>) => Promise<void>;

export function useUndoStack() {
  const stackRef = useRef<UndoEntry[]>([]);

  const push = useCallback((entry: UndoEntry) => {
    stackRef.current = [entry, ...stackRef.current].slice(0, 20);
  }, []);

  const undo = useCallback(async (updateShotFn: UpdateShotFn) => {
    const entry = stackRef.current.shift();
    if (!entry) return;
    await updateShotFn(entry.shotId, entry.before);
  }, []);

  const canUndo = useCallback(() => stackRef.current.length > 0, []);

  return { push, undo, canUndo };
}

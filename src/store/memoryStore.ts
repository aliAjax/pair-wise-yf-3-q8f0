import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, RevisitDays, Revisit } from '../utils/constants';
import { MAX_CONCURRENT_REVISITS } from '../utils/constants';
import { generateId } from '../utils/helpers';
import { mockMemories } from '../data/mockData';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

export interface ScheduleResult {
  /** 是否安排成功；false 表示已排满，新选择未保存 */
  ok: boolean;
  /** 排满时，最早安排的那段回访记忆 */
  oldest?: SmellMemory;
}

interface MemoryStore {
  memories: SmellMemory[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  /** 安排回访；已排满 5 段时不保存，返回最旧的一段安排 */
  scheduleRevisit: (id: string, days: RevisitDays) => ScheduleResult;
  cancelRevisit: (id: string) => void;
  initIfEmpty: () => void;
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
        };
        set({ memories: [newMem, ...get().memories] });
      },
      updateMemory: (id, input) => {
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
        });
      },
      deleteMemory: (id) => {
        set({ memories: get().memories.filter((m) => m.id !== id) });
      },
      scheduleRevisit: (id, days) => {
        const target = get().memories.find((m) => m.id === id);
        if (!target) return { ok: false };

        const active = get().memories.filter((m) => m.revisit);
        // 同一段记忆改期不算新占名额
        const activeOthers = active.filter((m) => m.id !== id);
        if (activeOthers.length >= MAX_CONCURRENT_REVISITS) {
          const oldest = activeOthers.reduce((a, b) =>
            a.revisit!.scheduled_at < b.revisit!.scheduled_at ? a : b,
          );
          // 不保存新选择，原日程照常保留
          return { ok: false, oldest };
        }

        const nowIso = new Date().toISOString();
        const revisit: Revisit = {
          scheduled_at: nowIso,
          revisit_at: new Date(Date.now() + days * 86400000).toISOString(),
          days,
        };
        set({
          memories: get().memories.map((m) =>
            m.id === id ? { ...m, revisit } : m,
          ),
        });
        return { ok: true };
      },
      cancelRevisit: (id) => {
        set({
          memories: get().memories.map((m) => {
            if (m.id !== id || !m.revisit) return m;
            const { revisit, ...rest } = m;
            void revisit;
            return rest;
          }),
        });
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

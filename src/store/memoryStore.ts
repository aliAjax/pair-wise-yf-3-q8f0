import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, RevisitDays, RevisitPlan } from '../utils/constants';
import { MAX_REVISITS } from '../utils/constants';
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
  ok: boolean;
  /** 排满时，需要先取消的最旧一段回访所在记忆 */
  oldest?: SmellMemory;
}

interface MemoryStore {
  memories: SmellMemory[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
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
        // 已经安排了回访的记忆重新选择间隔，不占用新名额
        const active = get().memories.filter((m) => m.revisit && m.id !== id);
        if (active.length >= MAX_REVISITS) {
          // 提示先取消最旧的一段（按安排时间最早计），本次选择不保存
          const oldest = active
            .slice()
            .sort(
              (a, b) =>
                new Date(a.revisit!.scheduled_at).getTime() -
                new Date(b.revisit!.scheduled_at).getTime(),
            )[0];
          return { ok: false, oldest };
        }
        if (!target) return { ok: false };
        const now = Date.now();
        const plan: RevisitPlan = {
          scheduled_at: new Date(now).toISOString(),
          due_at: new Date(now + days * 86400000).toISOString(),
          days,
        };
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, revisit: plan, updated_at: new Date(now).toISOString() }
              : m,
          ),
        });
        return { ok: true };
      },
      cancelRevisit: (id) => {
        set({
          memories: get().memories.map((m) =>
            m.id === id && m.revisit
              ? { ...m, revisit: undefined, updated_at: new Date().toISOString() }
              : m,
          ),
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

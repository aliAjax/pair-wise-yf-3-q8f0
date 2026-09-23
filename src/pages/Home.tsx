import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories, hasAnyFilter } from '../utils/helpers';
import type { SmellMemory, RevisitDays } from '../utils/constants';
import { MAX_CONCURRENT_REVISITS } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck } from 'lucide-react';
import { useNow } from '../hooks/useNow';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
  revisit: '',
};

export default function Home() {
  const { memories, initIfEmpty, addMemory, updateMemory, deleteMemory, scheduleRevisit, cancelRevisit } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);
  const now = useNow();

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters, now),
    [memories, filters, now],
  );

  const activeRevisitCount = useMemo(
    () => memories.filter((m) => m.revisit).length,
    [memories],
  );

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = (data: MemoryInput) => {
    if (editing) {
      updateMemory(editing.id, data);
    } else {
      addMemory(data);
    }
  };

  const handleScheduleRevisit = (m: SmellMemory, days: RevisitDays) => {
    const result = scheduleRevisit(m.id, days);
    if (result.ok) return;
    if (!result.oldest) return;
    window.alert(
      `最多同时安排 ${MAX_CONCURRENT_REVISITS} 段回访，现在已经排满啦。\n\n` +
      `请先取消最早安排的「${result.oldest.location}」的回访，再重新选择新的时间。`,
    );
  };

  const handleCancelRevisit = (m: SmellMemory) => {
    if (window.confirm(`确认取消「${m.location}」的回访安排吗？取消后卡片恢复普通状态。`)) {
      cancelRevisit(m.id);
    }
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    if (target?.revisit) {
      window.alert(
        `「${target.location}」还安排着回访呢。\n\n请先取消回访，再删除这段记忆。`,
      );
      return;
    }
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="min-h-screen">
      <Header onAdd={openAddModal} memoryCount={memories.length} />

      <main className="container max-w-6xl pb-20">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <VisualizationPanel memories={filteredMemories} onSelect={scrollToCard} />

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
              {activeRevisitCount > 0 && (
                <span className="text-sm font-sans text-lavender-600 bg-lavender-300/30 border border-lavender-300/50 rounded-full px-2.5 py-0.5">
                  回访中 {activeRevisitCount}/{MAX_CONCURRENT_REVISITS}
                </span>
              )}
            </h2>
            <span className="text-xs text-ink-700/50">
              点击卡片展开完整回忆
            </span>
          </div>

          {filteredMemories.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">
                {hasAnyFilter(filters)
                  ? '没有匹配的气味记忆'
                  : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {hasAnyFilter(filters)
                  ? '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {(filters.smellType || filters.season || filters.emotion || filters.revisit) && (
                  <button onClick={resetFilters} className="btn-secondary">
                    清除筛选条件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="masonry-grid">
              {filteredMemories.map((m, idx) => (
                <div key={m.id} data-memory-id={m.id}>
                  <MemoryCard
                    memory={m}
                    index={idx}
                    now={now}
                    isExpanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
                    onScheduleRevisit={(days) => handleScheduleRevisit(m, days)}
                    onCancelRevisit={() => handleCancelRevisit(m)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>愿每一缕气味，都是打开旧时光的钥匙 · Scent Archive</p>
      </footer>

      <MemoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editingData={editing}
      />
    </div>
  );
}

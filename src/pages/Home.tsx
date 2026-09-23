import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories } from '../utils/helpers';
import type { RevisitDays } from '../utils/constants';
import type { SmellMemory } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck } from 'lucide-react';

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

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters),
    [memories, filters],
  );

  const activeFilterCount = [filters.smellType, filters.season, filters.emotion, filters.revisit].filter(Boolean).length;

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

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    // 已安排回访的记忆，移除前先提示取消回访
    if (target?.revisit) {
      const cancel = window.confirm(
        `「${target.location}」正在回访安排中，需要先取消回访才能移除。\n\n点击「确定」取消回访（记忆保留，卡片恢复普通状态）；之后可再次删除。`,
      );
      if (!cancel) return;
      cancelRevisit(id);
      return;
    }
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleScheduleRevisit = (id: string, days: RevisitDays) => {
    const result = scheduleRevisit(id, days);
    if (!result.ok && result.oldest) {
      // 已排满 5 段：提示先取消最旧的一段，本次选择不保存，原有日程照常保留
      const oldestId = result.oldest.id;
      alert(
        `最多同时安排 5 段回访，已经排满了。\n\n请先取消最旧的一段：\n「${result.oldest.location}」（安排于 ${new Date(result.oldest.revisit!.scheduled_at).toLocaleDateString('zh-CN')}）\n\n已为你定位到这段记忆。`,
      );
      // 重置筛选，避免最旧的一段不在当前列表里而无法定位
      setFilters(defaultFilters);
      setExpandedId(oldestId);
      setTimeout(() => {
        const el = document.querySelector(`[data-memory-id="${oldestId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    } else if (result.ok) {
      setExpandedId(id);
    }
  };

  const handleCancelRevisit = (id: string) => {
    cancelRevisit(id);
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
            </h2>
            <span className="text-xs text-ink-700/50">
              点击卡片展开完整回忆
            </span>
          </div>

          {filteredMemories.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">
                {activeFilterCount > 0
                  ? '没有匹配的气味记忆'
                  : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {activeFilterCount > 0
                  ? '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {activeFilterCount > 0 && (
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
                    isExpanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
                    onScheduleRevisit={(days) => handleScheduleRevisit(m.id, days)}
                    onCancelRevisit={() => handleCancelRevisit(m.id)}
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

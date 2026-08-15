'use client';

import { memo, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Requirement {
  id: string;
  name?: string;
  title: string;
  citation: string;
  agency: string;
  confidence: number;
  appliesTo?: string;
  triggers?: string[];
  excerpt?: string;
  status?: 'pending' | 'in_progress' | 'compliant' | 'non_compliant' | 'n_a';
  priority?: 'high' | 'medium' | 'low' | number | null;
  notes?: string;
  sortOrder?: number | null;
  dueDate?: string | null;
  calendarTracking?: boolean;
  frequency?: 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'one_time' | null;
}

interface DraggableRequirementsListProps {
  requirements: Requirement[];
  activeTab: string;
  visibleCount: number;
  totalCount: number;
  onDragStart: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  renderRequirement: (req: Requirement, index: number, isNew: boolean) => React.ReactNode;
}

// Sortable wrapper component
function SortableRequirementCard({
  id,
  children
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start">
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-2 mt-2 mr-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors touch-none"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

function DraggableRequirementsList({
  requirements,
  activeTab,
  visibleCount,
  totalCount,
  onDragStart,
  onDragEnd,
  onDragCancel,
  renderRequirement,
}: DraggableRequirementsListProps) {
  // DnD sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // Memoize sortable items array
  const sortableItems = useMemo(
    () => requirements.map((req, index) => req.id || `${activeTab}-${index}`),
    [requirements, activeTab]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext
        items={sortableItems}
        strategy={verticalListSortingStrategy}
      >
        <div className="divide-y divide-slate-800/50">
          {requirements.map((req, index) => {
            const reqId = req.id || `${activeTab}-${index}`;
            const isNew = index === visibleCount - 1 && visibleCount < totalCount;
            return (
              <SortableRequirementCard key={reqId} id={reqId}>
                {renderRequirement(req, index, isNew)}
              </SortableRequirementCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default memo(DraggableRequirementsList);

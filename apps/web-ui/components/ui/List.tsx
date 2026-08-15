'use client'

import React, { useState, useEffect, KeyboardEvent } from 'react'
import Card from './Card'

interface ListItem {
  id: string
  title: string
  subtitle?: string
  status?: 'active' | 'pending' | 'overdue' | 'completed'
}

interface ListProps<T extends ListItem> {
  items: T[]
  onItemClick?: (item: T) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  multiSelect?: boolean
  renderContent?: (item: T) => React.ReactNode
  renderActions?: (item: T) => React.ReactNode
}

export default function List<T extends ListItem>({
  items,
  onItemClick,
  onSelectionChange,
  multiSelect = false,
  renderContent,
  renderActions,
}: ListProps<T>) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    onSelectionChange?.(selectedItems)
  }, [selectedItems, onSelectionChange])

  const handleItemClick = (item: T) => {
    if (multiSelect) {
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        if (newSet.has(item.id)) {
          newSet.delete(item.id)
        } else {
          newSet.add(item.id)
        }
        return newSet
      })
    } else {
      setSelectedItems(new Set([item.id]))
    }
    onItemClick?.(item)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(Math.min(index + 1, items.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(Math.max(index - 1, 0))
        break
      case ' ':
        e.preventDefault()
        handleItemClick(items[index])
        break
      case 'Enter':
        e.preventDefault()
        onItemClick?.(items[index])
        break
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (multiSelect) {
            setSelectedItems(new Set(items.map(item => item.id)))
          }
        }
        break
    }
  }

  useEffect(() => {
    const element = document.getElementById(items[focusedIndex]?.id)
    element?.focus()
  }, [focusedIndex, items])

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-black">
        No items to display
      </div>
    )
  }

  return (
    <div
      className="space-y-3"
      role="list"
      aria-label="Obligations list"
      aria-multiselectable={multiSelect}
    >
      {items.map((item, index) => (
        <div key={item.id} role="listitem">
          <Card
            {...item}
            isSelected={selectedItems.has(item.id)}
            onClick={() => handleItemClick(item)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {renderContent && (
              <div className="mt-3">
                {renderContent(item)}
              </div>
            )}
            {renderActions && (
              <div className="mt-3 flex items-center space-x-3">
                {renderActions(item)}
              </div>
            )}
          </Card>
        </div>
      ))}
    </div>
  )
}
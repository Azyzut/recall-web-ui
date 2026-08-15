'use client'

import React, { KeyboardEvent } from 'react'

interface CardProps {
  id: string
  title: string
  subtitle?: string
  status?: 'active' | 'pending' | 'overdue' | 'completed'
  isSelected?: boolean
  onClick?: (id: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  children?: React.ReactNode
}

export default function Card({
  id,
  title,
  subtitle,
  status = 'active',
  isSelected = false,
  onClick,
  onKeyDown,
  children,
}: CardProps) {
  const statusColors = {
    active: 'border-l-primary-500 bg-primary-50',
    pending: 'border-l-warning-500 bg-warning-50',
    overdue: 'border-l-error-500 bg-error-50',
    completed: 'border-l-success-500 bg-success-50',
  }

  const statusLabels = {
    active: 'Active',
    pending: 'Pending',
    overdue: 'Overdue',
    completed: 'Completed',
  }

  const statusBadgeColors = {
    active: 'bg-primary-100 text-primary-700',
    pending: 'bg-warning-100 text-warning-700',
    overdue: 'bg-error-100 text-error-700',
    completed: 'bg-success-100 text-success-700',
  }

  return (
    <div
      id={id}
      role="article"
      tabIndex={0}
      className={`
        relative p-4 bg-white border-l-4 rounded-lg shadow-sm
        transition-all duration-200 cursor-pointer
        hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500
        ${statusColors[status]}
        ${isSelected ? 'ring-2 ring-primary-500' : 'border border-gray-200'}
      `}
      onClick={() => onClick?.(id)}
      onKeyDown={onKeyDown}
      aria-selected={isSelected}
      aria-label={`${title} - ${statusLabels[status]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-black">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-black">{subtitle}</p>
          )}
          {children}
        </div>
        <span
          className={`
            ml-4 px-2 py-1 text-xs font-medium rounded-full
            ${statusBadgeColors[status]}
          `}
          aria-label={`Status: ${statusLabels[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>
    </div>
  )
}
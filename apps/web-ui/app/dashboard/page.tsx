'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import List from '@/components/ui/List'

interface ObligationItem {
  id: string
  title: string
  subtitle: string
  status: 'active' | 'pending' | 'overdue'
  dueDate: string
  category: string
  frequency?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [obligations, setObligations] = useState<ObligationItem[]>([])
  const [stats, setStats] = useState({
    total: 0,
    dueThisMonth: 0,
    overdue: 0
  })

  useEffect(() => {
    // Load user's selected obligations from localStorage
    const savedData = localStorage.getItem('userObligations')
    
    if (!savedData) {
      // If no obligations saved, redirect to onboarding
      router.push('/onboarding')
      return
    }

    const { obligations: selectedObligations } = JSON.parse(savedData)
    
    // Transform obligations to dashboard format and calculate status
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    const formattedObligations = selectedObligations.map((ob: any) => {
      const dueDate = ob.nextDue ? new Date(ob.nextDue) : null
      let status: 'active' | 'pending' | 'overdue' = 'active'
      
      if (dueDate) {
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntilDue < 0) {
          status = 'overdue'
        } else if (daysUntilDue <= 30) {
          status = 'pending'
        } else {
          status = 'active'
        }
      }
      
      return {
        id: ob.id,
        title: ob.name,
        subtitle: ob.description,
        status,
        dueDate: ob.nextDue || 'Ongoing',
        category: ob.category,
        frequency: ob.frequency
      }
    })

    // Sort obligations by status and due date
    formattedObligations.sort((a: ObligationItem, b: ObligationItem) => {
      const statusOrder = { overdue: 0, pending: 1, active: 2 }
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status]
      }
      if (a.dueDate === 'Ongoing') return 1
      if (b.dueDate === 'Ongoing') return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

    // Calculate statistics
    const overdueCount = formattedObligations.filter((ob: ObligationItem) => ob.status === 'overdue').length
    const dueThisMonthCount = formattedObligations.filter((ob: ObligationItem) => {
      if (ob.dueDate === 'Ongoing') return false
      const dueDate = new Date(ob.dueDate)
      return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear
    }).length

    setObligations(formattedObligations)
    setStats({
      total: formattedObligations.length,
      dueThisMonth: dueThisMonthCount,
      overdue: overdueCount
    })
  }, [router])

  const handleItemClick = (item: ObligationItem) => {
    console.log('Clicked obligation:', item)
    // Navigate to obligation details or matrix view
    router.push(`/matrix?obligation=${item.id}`)
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      overdue: '🔴 Overdue',
      pending: '🟡 Due Soon',
      active: '🟢 Active'
    }
    return badges[status as keyof typeof badges] || status
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Dashboard</h1>
        <p className="text-black mt-1">Welcome to your Product Recall Tracker</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Obligations</p>
              <p className="text-3xl font-bold text-black mt-1">{stats.total}</p>
            </div>
            <div className="text-3xl">📋</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Due This Month</p>
              <p className="text-3xl font-bold text-warning-600 mt-1">{stats.dueThisMonth}</p>
            </div>
            <div className="text-3xl">⏰</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Overdue</p>
              <p className="text-3xl font-bold text-error-600 mt-1">{stats.overdue}</p>
            </div>
            <div className="text-3xl">⚠️</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-black">Your Compliance Obligations</h2>
          <button
            onClick={() => router.push('/onboarding')}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Edit Obligations
          </button>
        </div>
        
        {obligations.length > 0 ? (
          <List
            items={obligations}
            onItemClick={handleItemClick}
            renderContent={(item) => (
              <div className="text-sm text-black">
                <div className="flex gap-4">
                  <span>{getStatusBadge(item.status)}</span>
                  <span>Due: {item.dueDate}</span>
                  <span>Category: {item.category}</span>
                  {item.frequency && <span>Frequency: {item.frequency}</span>}
                </div>
              </div>
            )}
            renderActions={(item) => (
              <>
                <button
                  className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('View details:', item.id)
                  }}
                >
                  View Details
                </button>
                <span className="text-black">|</span>
                <button
                  className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('Upload evidence:', item.id)
                  }}
                >
                  Upload Evidence
                </button>
                {item.status === 'overdue' && (
                  <>
                    <span className="text-black">|</span>
                    <button
                      className="text-sm text-error-600 hover:text-error-700 focus:outline-none focus:underline font-semibold"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('Mark complete:', item.id)
                      }}
                    >
                      Mark Complete
                    </button>
                  </>
                )}
              </>
            )}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-black mb-4">No obligations configured yet.</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
            >
              Set Up Your Obligations
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
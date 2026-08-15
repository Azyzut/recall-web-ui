'use client'

import AppShell from '@/components/layout/AppShell'

export default function TimelinePage() {
  return (
    <AppShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">Timeline</h1>
          <p className="text-black mt-1">Calendar view of compliance deadlines</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
          <div className="text-center text-black">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-lg font-medium">Timeline View Coming Soon</p>
            <p className="text-sm mt-2">
              This will display a calendar view of all your compliance obligations and deadlines.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
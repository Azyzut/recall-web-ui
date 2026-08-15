'use client'

import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'

export default function TemplatesPage() {
  const [naicsCode, setNaicsCode] = useState('')
  const [state, setState] = useState('')

  const handleGenerateTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Generating template for:', { naicsCode, state })
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">Template Factory</h1>
          <p className="text-black mt-1">Generate compliance templates based on your industry and location</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <form onSubmit={handleGenerateTemplate} className="max-w-2xl">
            <h2 className="text-lg font-semibold text-black mb-4">Generate New Template</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="naics" className="block text-sm font-medium text-black">
                  NAICS Code
                </label>
                <input
                  id="naics"
                  type="text"
                  value={naicsCode}
                  onChange={(e) => setNaicsCode(e.target.value)}
                  placeholder="e.g., 325998"
                  className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-black placeholder:text-black"
                  required
                />
                <p className="mt-1 text-xs text-black">
                  Enter your 6-digit North American Industry Classification System code
                </p>
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-black">
                  State
                </label>
                <select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-black placeholder:text-black"
                  required
                >
                  <option value="">Select a state</option>
                  <option value="CA">California</option>
                  <option value="TX">Texas</option>
                  <option value="NY">New York</option>
                  <option value="FL">Florida</option>
                  <option value="IL">Illinois</option>
                  <option value="PA">Pennsylvania</option>
                  <option value="OH">Ohio</option>
                  <option value="GA">Georgia</option>
                  <option value="NC">North Carolina</option>
                  <option value="MI">Michigan</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Generate Template
              </button>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-neutral-200">
            <h3 className="text-lg font-semibold text-black mb-4">Recent Templates</h3>
            <div className="space-y-3">
              <div className="p-4 border border-neutral-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-black">Chemical Manufacturing - California</p>
                    <p className="text-sm text-black">NAICS: 325998 | 42 obligations</p>
                  </div>
                  <button className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:underline">
                    View Template
                  </button>
                </div>
              </div>

              <div className="p-4 border border-neutral-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-black">Petroleum Refining - Texas</p>
                    <p className="text-sm text-black">NAICS: 324110 | 67 obligations</p>
                  </div>
                  <button className="text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus:underline">
                    View Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
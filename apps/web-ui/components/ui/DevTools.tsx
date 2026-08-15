'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DevTools() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleReset = () => {
    // Clear all localStorage
    localStorage.clear()
    
    // Clear all sessionStorage
    sessionStorage.clear()
    
    // Clear cookies (for auth)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
    
    // Redirect to home page
    router.push('/')
    
    // Force a hard refresh to clear any cached state
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const handleQuickLogin = () => {
    // Simulate a logged-in user without obligations for testing onboarding
    localStorage.setItem('authToken', 'test-token-123')
    localStorage.removeItem('userObligations')
    router.push('/onboarding')
  }

  const handleQuickSetup = () => {
    // Simulate a fully onboarded user
    const mockObligations = {
      industry: 'construction',
      naicsCode: '236xxx',
      obligations: [
        { id: 'fda-recall-1', name: 'FDA Class I Recall', category: 'Food Safety', description: 'Track and respond to Class I food recall', frequency: 'One-Time', nextDue: '2024-02-01' },
        { id: 'cpsc-recall-1', name: 'CPSC Product Recall', category: 'Consumer Products', description: 'Track consumer product recall response', frequency: 'One-Time', nextDue: '2024-03-15' },
      ]
    }
    localStorage.setItem('userObligations', JSON.stringify(mockObligations))
    localStorage.setItem('authToken', 'test-token-123')
    router.push('/dashboard')
  }

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <>
      {/* Floating Dev Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-3 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
        title="Developer Tools"
      >
        🛠️
      </button>

      {/* Dev Tools Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-black">Dev Tools</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-black hover:text-black"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={handleReset}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              🔄 Clear All & Restart Journey
            </button>
            
            <button
              onClick={handleQuickLogin}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              ⚡ Quick Login (Skip Auth)
            </button>
            
            <button
              onClick={handleQuickSetup}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              ✅ Quick Setup (Skip Onboarding)
            </button>
            
            <div className="pt-2 mt-2 border-t border-gray-200">
              <p className="text-xs text-black">
                Current State:
              </p>
              <p className="text-xs text-black mt-1">
                Auth: {typeof window !== 'undefined' && localStorage.getItem('authToken') ? '✅ Logged In' : '❌ Not Logged In'}
              </p>
              <p className="text-xs text-black">
                Onboarded: {typeof window !== 'undefined' && localStorage.getItem('userObligations') ? '✅ Yes' : '❌ No'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
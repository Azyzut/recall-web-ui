'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Simplified auth without verification step
export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      // Simulate authentication - in production this would validate against a backend
      if (email && email.includes('@')) {
        // Set authentication state
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('userEmail', email)
        
        setMessage({ type: 'success', text: 'Successfully authenticated!' })
        
        setTimeout(() => {
          // Check if user has completed onboarding
          const hasCompletedOnboarding = localStorage.getItem('userObligations')
          if (!hasCompletedOnboarding) {
            // New user - redirect to onboarding
            router.push('/onboarding')
          } else {
            // Existing user - go to dashboard
            router.push('/dashboard')
          }
        }, 500)
      } else {
        setMessage({ type: 'error', text: 'Please enter a valid email address' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to authenticate' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-black text-center">
            Product Recall Tracker
          </h2>
          <p className="mt-2 text-center text-black">
            Sign in to your account
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-success-50 text-success-700'
                : 'bg-error-50 text-error-700'
            }`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-black">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-black placeholder:text-black"
              placeholder="you@company.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Just enter any email to continue (demo mode)
          </p>
        </form>
      </div>
    </div>
  )
}
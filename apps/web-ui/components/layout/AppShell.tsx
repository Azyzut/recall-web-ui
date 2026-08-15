'use client'

import { useRouter, usePathname } from 'next/navigation'
import { auth } from '@/lib/auth'
import AgentPanel from './AgentPanel'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Matrix', href: '/matrix', icon: '📋' },
    { name: 'Timeline', href: '/timeline', icon: '📅' },
    { name: 'Templates', href: '/templates', icon: '🏭' },
  ]

  const handleSignOut = async () => {
    await auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-black">
                  Recall Tracker
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault()
                      router.push(item.href)
                    }}
                    className={`
                      inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                      ${pathname === item.href
                        ? 'border-primary-500 text-black'
                        : 'border-transparent text-black hover:border-gray-400 hover:text-black'
                      }
                    `}
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-black hover:text-black focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <main className="flex-1 mr-80">
          {children}
        </main>
        <AgentPanel />
      </div>
    </div>
  )
}
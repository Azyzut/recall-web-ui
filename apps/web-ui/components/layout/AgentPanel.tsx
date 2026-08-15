'use client'

import { useState } from 'react'

type Tab = 'ask' | 'updates' | 'docs'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AgentPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ask')
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    }

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Based on your internal obligations, here's what I found about "${query}". This is a stub response for Core v0.`,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setQuery('')
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'ask', label: 'Ask', icon: '💬' },
    { id: 'updates', label: 'Updates', icon: '📰' },
    { id: 'docs', label: 'Docs', icon: '📄' },
  ]

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-white border-l border-neutral-200 flex flex-col">
      <div className="p-4 border-b border-neutral-200">
        <h2 className="text-lg font-semibold text-black">Recall Advisor</h2>
        <p className="text-sm text-black mt-1">Your recall response assistant</p>
      </div>

      <div className="flex border-b border-neutral-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-black hover:text-black hover:bg-gray-50'
              }
            `}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'ask' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-black mt-8">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-sm">
                    Ask me about product recalls, response procedures, or supply chain impact.
                  </p>
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className={`
                      p-3 rounded-lg
                      ${message.role === 'user'
                        ? 'bg-primary-50 text-primary-900 ml-auto max-w-[80%]'
                        : 'bg-gray-100 text-black mr-auto max-w-[80%]'
                      }
                    `}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs text-black mt-1">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about recalls..."
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-black placeholder:text-black"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'updates' && (
          <div className="flex-1 p-4">
            <div className="text-center text-black mt-8">
              <div className="text-4xl mb-3">📰</div>
              <p>Updates tab coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="flex-1 p-4">
            <div className="text-center text-black mt-8">
              <div className="text-4xl mb-3">📄</div>
              <p>Docs tab coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
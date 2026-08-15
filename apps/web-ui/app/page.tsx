'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Product Recalls,{' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Tracked
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10">
            AI-powered recall discovery and response tracking. Know exactly which FDA and CPSC recalls affect your supply chain in minutes.
          </p>
          <button
            onClick={() => router.push('/discover')}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            Start Free Scan
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Automated Discovery</h3>
            <p className="text-slate-400">
              AI scans FDA and CPSC databases to identify all active recalls affecting your product categories and supply chain.
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Risk Assessment</h3>
            <p className="text-slate-400">
              Get severity scores and supply chain impact analysis for each recall. Know exactly how a recall affects your operations.
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Response Tracking</h3>
            <p className="text-slate-400">
              Track your recall response status, manage deadlines, and maintain documentation all in one place.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-12 mb-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <span className="text-blue-400 text-xl font-bold">1</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Enter Your Info</h4>
              <p className="text-sm text-slate-400">Company name, product categories, and supply chain role</p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <span className="text-blue-400 text-xl font-bold">2</span>
              </div>
              <h4 className="font-semibold text-white mb-2">AI Analysis</h4>
              <p className="text-sm text-slate-400">We scan FDA and CPSC recall databases</p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <span className="text-blue-400 text-xl font-bold">3</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Get Your Dashboard</h4>
              <p className="text-sm text-slate-400">20+ relevant recalls with severity scores</p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                <span className="text-blue-400 text-xl font-bold">4</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Stay Protected</h4>
              <p className="text-sm text-slate-400">Track responses, manage deadlines, chat with AI</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">200,000+</div>
            <div className="text-slate-400">Active Recalls Monitored</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">~5 min</div>
            <div className="text-slate-400">Discovery Time</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">24/7</div>
            <div className="text-slate-400">Continuous Monitoring</div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-slate-400 mb-6 text-lg">Ready to protect your supply chain?</p>
          <button
            onClick={() => router.push('/register')}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-10 py-4 rounded-lg text-lg font-semibold transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            Start Your Free Trial
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div className="text-slate-500 text-sm">
              &copy; 2025 Product Recall Tracker. All rights reserved.
            </div>
            <div className="flex gap-6">
              <Link href="/terms" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

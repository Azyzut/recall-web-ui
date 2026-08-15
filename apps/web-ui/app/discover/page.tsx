'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';

interface DiscoveredRequirement {
  id: string;
  name: string;
  citation: string;
  title: string;
  agency: 'FDA' | 'CPSC' | 'OTHER';
  part: string;
  section?: string;
  excerpt: string;
  appliesTo: string;
  triggers: string[];
  confidence: number;
  source: string;
  discoveredAt: string;
}

interface DiscoveryResponse {
  success: boolean;
  naicsCode: string;
  totalRequirements: number;
  requirements: DiscoveredRequirement[];
  discoveredAt: string;
  error?: string;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // User inputs
  const [companyName, setCompanyName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [supplyChainRole, setSupplyChainRole] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [state, setState] = useState('OR');
  const [website, setWebsite] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  // Pre-fill email from session if authenticated
  const isAuthenticated = !!session?.user?.email;
  useEffect(() => {
    if (session?.user?.email && !companyEmail) {
      setCompanyEmail(session.user.email);
    }
  }, [session?.user?.email, companyEmail]);

  // Discovery state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryResponse | null>(null);

  const maxResults = 20;
  const [includeCPSC, setIncludeCPSC] = useState(true);

  const discoverRequirements = async () => {
    if (!productCategory) {
      setError('Please select a product category');
      return;
    }
    if (!employeeCount) {
      setError('Please enter employee count');
      return;
    }
    if (!companyEmail) {
      setError('Please enter your company email');
      return;
    }
    if (!companyEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // Fire off the discovery request (don't await - it runs in background on server)
    fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        productCategory,
        supplyChainRole,
        employeeCount: parseInt(employeeCount, 10),
        naicsCode: productCategory, // reuse field for compatibility
        website,
        state,
        email: companyEmail,
        maxResults,
        includeCPSC,
      }),
    }).catch((err) => {
      console.error('Discovery request failed:', err);
    });

    // Poll for the company's access token, then redirect with it
    const pollForToken = async () => {
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        try {
          const res = await fetch(`/api/company/token?email=${encodeURIComponent(companyEmail)}`);
          if (res.ok) {
            const data = await res.json();
            router.push(`/matrix?token=${encodeURIComponent(data.accessToken)}`);
            return;
          }
        } catch {
          // Keep polling
        }
      }
      // Fallback: if token never appears, show error
      setError('Discovery is taking longer than expected. Please try again.');
      setLoading(false);
    };
    pollForToken();
  };

  const getAgencyColor = (agency: string) => {
    switch (agency) {
      case 'FDA': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'CPSC': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-400';
    if (confidence >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">
            Scan for Recalls
          </h1>
          <p className="text-slate-400 text-lg">
            Enter your product information and we&apos;ll identify all relevant FDA and CPSC recalls
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Acme Foods Inc"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Product Category <span className="text-red-400">*</span>
              </label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              >
                <option value="">Select a category...</option>
                <option value="Food & Beverages">Food & Beverages</option>
                <option value="Drugs & Pharmaceuticals">Drugs & Pharmaceuticals</option>
                <option value="Medical Devices">Medical Devices</option>
                <option value="Consumer Products">Consumer Products</option>
                <option value="Toys & Children's Products">Toys & Children&apos;s Products</option>
                <option value="Household Chemicals">Household Chemicals</option>
                <option value="Automotive Parts">Automotive Parts</option>
                <option value="Electronics">Electronics</option>
                <option value="Cosmetics & Personal Care">Cosmetics & Personal Care</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Supply Chain Role
              </label>
              <select
                value={supplyChainRole}
                onChange={(e) => setSupplyChainRole(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              >
                <option value="">Select a role...</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Distributor">Distributor</option>
                <option value="Retailer">Retailer</option>
                <option value="Importer">Importer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Distribution Region
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              >
                <option value="OR">Oregon</option>
                <option value="CA">California</option>
                <option value="WA">Washington</option>
                <option value="TX">Texas</option>
                <option value="NY">New York</option>
                <option value="FL">Florida</option>
                <option value="IL">Illinois</option>
                <option value="PA">Pennsylvania</option>
                <option value="OH">Ohio</option>
                <option value="GA">Georgia</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Employee Count <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                placeholder="e.g., 45"
                min="1"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              />
              <p className="text-xs text-slate-500 mt-2">
                Used for threshold-based recall requirements
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Company Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g., https://acme-foods.com"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              />
              <p className="text-xs text-slate-500 mt-2">
                We analyze your site to identify relevant products
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Your Email <span className="text-red-400">*</span>
                {isAuthenticated && (
                  <span className="ml-2 text-xs text-emerald-400 font-normal">(from your account)</span>
                )}
              </label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => !isAuthenticated && setCompanyEmail(e.target.value)}
                readOnly={isAuthenticated}
                placeholder="e.g., john@acme-foods.com"
                className={`w-full px-4 py-3 border rounded-lg text-white placeholder-slate-500 focus:outline-none transition-all ${
                  isAuthenticated
                    ? 'bg-slate-700/50 border-emerald-600/50 cursor-not-allowed'
                    : 'bg-slate-800/50 border-slate-600/50 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent'
                }`}
              />
              <p className="text-xs text-slate-500 mt-2">
                {isAuthenticated
                  ? 'Results will be linked to your account'
                  : 'Results will be saved to your account'
                }
              </p>
            </div>
          </div>

          {/* Agency Toggles */}
          <div className="flex flex-wrap gap-4 mb-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className="text-slate-300">FDA</span>
              <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">Always included</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCPSC}
                onChange={(e) => setIncludeCPSC(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/50"
              />
              <span className="text-slate-300">CPSC</span>
            </label>
          </div>

          {/* Discover Button */}
          <button
            onClick={discoverRequirements}
            disabled={loading || !productCategory || !employeeCount || !companyEmail}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-500 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning recall databases... (this takes ~2 minutes)
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Scan for Recalls
              </>
            )}
          </button>

          {/* Quick Test Scenarios */}
          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <p className="text-sm font-medium text-slate-400 mb-3">Quick test scenarios:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { category: 'Food & Beverages', label: 'Food Manufacturer' },
                { category: 'Medical Devices', label: 'Device Distributor' },
                { category: 'Consumer Products', label: 'Retailer' },
                { category: 'Drugs & Pharmaceuticals', label: 'Pharma Company' },
                { category: 'Toys & Children\'s Products', label: 'Toy Importer' },
              ].map(({ category, label }) => (
                <button
                  key={category}
                  onClick={() => setProductCategory(category)}
                  className="px-3 py-1.5 text-sm bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-slate-300 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-8">
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            {/* Summary Header */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-700/50">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {companyName || productCategory}
                </h2>
                <p className="text-slate-400">
                  Found {result.totalRequirements} relevant recalls
                </p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Category: {productCategory}</p>
                <p>Scanned: {new Date(result.discoveredAt).toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Agency Summary */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {['FDA', 'CPSC'].map((agency) => {
                const count = result.requirements.filter(r => r.agency === agency).length;
                return (
                  <div key={agency} className={`p-4 rounded-xl border ${getAgencyColor(agency)}`}>
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-sm opacity-80">{agency} Recalls</p>
                  </div>
                );
              })}
            </div>

            {/* Requirements List */}
            <div className="space-y-4">
              {result.requirements.map((req) => (
                <div key={req.id} className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${getAgencyColor(req.agency)}`}>
                          {req.agency}
                        </span>
                        <span className="text-sm font-mono text-slate-400">{req.citation}</span>
                        <span className={`text-xs font-medium ${getConfidenceColor(req.confidence)}`}>
                          {req.confidence.toFixed(0)}% match
                        </span>
                      </div>
                      <h3 className="font-semibold text-white">{req.name || req.title}</h3>
                      {req.excerpt && (
                        <p className="text-sm text-slate-400 mt-2 line-clamp-2">{req.excerpt}</p>
                      )}
                      {req.appliesTo && (
                        <p className="text-sm text-blue-400 mt-2">
                          <span className="font-medium">Why it applies:</span> {req.appliesTo}
                        </p>
                      )}
                      {req.triggers && req.triggers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {req.triggers.map((trigger, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                              {trigger}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="ml-4 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700/30">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-medium mb-1">How Scanning Works</h3>
              <p className="text-slate-400 text-sm">
                Our AI scans FDA and CPSC recall databases to identify recalls affecting your product categories and supply chain. The process takes about 2 minutes and analyzes active recalls to find the most relevant ones for your operations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

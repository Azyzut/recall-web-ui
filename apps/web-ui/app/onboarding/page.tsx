'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Temporary placeholder types until dynamic system is built
interface ComplianceRequirement {
  id: string;
  name: string;
  category: string;
  required: boolean;
  defaultChecked: boolean;
  description: string;
  frequency?: string;
  regulation?: string;
  agency?: string;
  applicability?: string;
}

type OnboardingStep = 'industry' | 'obligations' | 'review';

interface ObligationTemplate extends ComplianceRequirement {
  nextDue?: string;
}

// Placeholder functions - will be replaced with dynamic FDA/CPSC API + reasoning model
function validateNAICSCode(code: string): { valid: boolean; message?: string } {
  const cleanCode = code.trim();
  if (!/^\d{2,6}$/.test(cleanCode)) {
    return { valid: false, message: 'NAICS code must be 2-6 digits' };
  }
  return { valid: true };
}

function getIndustryName(naicsCode: string): string {
  // TODO: This will be dynamically fetched via FDA/CPSC API + reasoning model
  return `Industry ${naicsCode}`;
}

function getComplianceByNAICS(_naicsCode: string): ComplianceRequirement[] {
  // TODO: This will be dynamically generated via FDA/CPSC API + reasoning model
  // Returns empty array - recall requirements will be generated dynamically
  return [];
}

// Popular industry quick-select options (kept for UX - just codes, no static requirements)
const INDUSTRY_OPTIONS = [
  { value: '23', label: 'Construction', naics: '236xxx' },
  { value: '31', label: 'General Industry', naics: '31-33' },
  { value: '621', label: 'Healthcare', naics: '621xxx' },
  { value: '32', label: 'Manufacturing', naics: '31-33' },
  { value: '44', label: 'Retail Trade', naics: '44-45' },
  { value: '484', label: 'Transportation & Warehousing', naics: '48-49' }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('industry');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [naicsCode, setNaicsCode] = useState('');
  const [naicsError, setNaicsError] = useState('');
  const [selectedObligations, setSelectedObligations] = useState<Set<string>>(new Set());
  const [obligations, setObligations] = useState<ObligationTemplate[]>([]);
  const [industryName, setIndustryName] = useState('');

  const handleIndustrySelect = () => {
    // Use direct NAICS input first, then fall back to selected industry
    const codeToUse = naicsCode || selectedIndustry;
    
    if (!codeToUse) {
      setNaicsError('Please enter a NAICS code or select an industry');
      return;
    }
    
    // Validate NAICS code if entered directly
    if (naicsCode) {
      const validation = validateNAICSCode(naicsCode);
      if (!validation.valid) {
        setNaicsError(validation.message || 'Invalid NAICS code');
        return;
      }
    }
    
    // Get recall requirements for this NAICS code
    const requirements = getComplianceByNAICS(codeToUse);
    const industry = getIndustryName(codeToUse);
    
    // Add sample due dates for demo purposes
    const templatesWithDates: ObligationTemplate[] = requirements.map((req, index) => ({
      ...req,
      nextDue: req.frequency && req.frequency !== 'Ongoing' 
        ? new Date(Date.now() + (30 + index * 15) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined
    }));
    
    setObligations(templatesWithDates);
    setIndustryName(industry);
    setNaicsCode(codeToUse); // Store the actual code used
    const defaultSelected = new Set(templatesWithDates.filter(t => t.defaultChecked).map(t => t.id));
    setSelectedObligations(defaultSelected);
    setStep('obligations');
  };

  const handleObligationToggle = (id: string) => {
    const newSelected = new Set(selectedObligations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedObligations(newSelected);
  };

  const handleComplete = () => {
    // Save selected obligations to localStorage for now
    const selectedData = {
      industry: industryName,
      naicsCode: naicsCode,
      obligations: obligations.filter(o => selectedObligations.has(o.id))
    };
    localStorage.setItem('userObligations', JSON.stringify(selectedData));
    localStorage.setItem('onboardingComplete', 'true');
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${step === 'industry' ? 'text-blue-600' : 'text-black'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'industry' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="ml-2 font-medium">Industry</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className={`flex items-center ${step === 'obligations' ? 'text-blue-600' : 'text-black'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'obligations' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="ml-2 font-medium">Obligations</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className={`flex items-center ${step === 'review' ? 'text-blue-600' : 'text-black'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'review' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="ml-2 font-medium">Review</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {step === 'industry' && (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
            <h2 className="text-2xl font-bold mb-6 text-black">Welcome! Let's set up your recall tracking profile</h2>
            <p className="text-black mb-8">
              Select your industry or enter your NAICS code to discover relevant product recalls for your supply chain.
            </p>

            {/* Direct NAICS Input - Always Visible */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium mb-2 text-black">
                Enter Your NAICS Code Directly
              </label>
              <input
                type="text"
                value={naicsCode}
                onChange={(e) => {
                  setNaicsCode(e.target.value);
                  setNaicsError('');
                  setSelectedIndustry(''); // Clear radio selection when typing
                }}
                placeholder="e.g., 236210, 3361, 62"
                className={`w-full px-4 py-3 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-black ${
                  naicsError ? 'border-red-500' : 'border-gray-300'
                }`}
                maxLength={6}
              />
              {naicsError && (
                <p className="text-red-500 text-sm mt-1">{naicsError}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Enter any 2-6 digit NAICS code. Find yours at{' '}
                <a 
                  href="https://www.census.gov/naics/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  census.gov/naics
                </a>
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or select a common industry</span>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {INDUSTRY_OPTIONS.map(option => (
                <label key={option.value} className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="industry"
                    value={option.value}
                    checked={selectedIndustry === option.value}
                    onChange={(e) => {
                      setSelectedIndustry(e.target.value);
                      setNaicsCode(''); // Clear NAICS input when selecting radio
                      setNaicsError('');
                    }}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-black">{option.label}</div>
                    <div className="text-sm text-black">NAICS: {option.naics}</div>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleIndustrySelect}
              disabled={!selectedIndustry && !naicsCode}
              className="mt-8 w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue to Obligations
            </button>
          </div>
        )}

        {step === 'obligations' && (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
            <h2 className="text-2xl font-bold mb-4 text-black">Relevant Recalls for {industryName}</h2>
            <p className="text-sm text-gray-600 mb-2">NAICS Code: {naicsCode}</p>
            <p className="text-black mb-6">
              Based on your NAICS code, we've identified {obligations.length} relevant recalls. Required items are pre-selected and cannot be removed.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {obligations.map(obligation => (
                <div key={obligation.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObligations.has(obligation.id)}
                      onChange={() => handleObligationToggle(obligation.id)}
                      className="mt-1 mr-3"
                      disabled={obligation.required}
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="font-medium text-black">
                          {obligation.name}
                          {obligation.required && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Required</span>
                          )}
                        </div>
                        {obligation.regulation && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {obligation.regulation}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{obligation.description}</div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="text-xs text-gray-600">
                          <span className="font-medium">Category:</span> {obligation.category}
                        </span>
                        {obligation.frequency && (
                          <span className="text-xs text-gray-600">
                            <span className="font-medium">Frequency:</span> {obligation.frequency}
                          </span>
                        )}
                        {obligation.agency && (
                          <span className="text-xs text-gray-600">
                            <span className="font-medium">Agency:</span> {obligation.agency}
                          </span>
                        )}
                        {obligation.nextDue && (
                          <span className="text-xs text-orange-600">
                            <span className="font-medium">Next Due:</span> {obligation.nextDue}
                          </span>
                        )}
                      </div>
                      {obligation.applicability && (
                        <div className="text-xs text-blue-700 mt-2 italic">
                          Applies to: {obligation.applicability}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep('industry')}
                className="flex-1 bg-gray-200 text-black py-3 rounded-lg font-medium hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Review Selection
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
            <h2 className="text-2xl font-bold mb-6 text-black">Review Your Recall Tracking Profile</h2>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold mb-3 text-black">Industry Information</h3>
              <p className="text-black">
                <span className="font-medium">{industryName}</span>
                <br />
                <span className="text-sm text-gray-600">NAICS Code: {naicsCode}</span>
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold mb-3 text-black">Selected Obligations ({selectedObligations.size})</h3>
              <div className="space-y-2">
                {obligations
                  .filter(o => selectedObligations.has(o.id))
                  .map(obligation => (
                    <div key={obligation.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium text-black">{obligation.name}</div>
                        <div className="text-sm text-black">{obligation.category}</div>
                      </div>
                      {obligation.nextDue && (
                        <div className="text-sm text-black">Due: {obligation.nextDue}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep('obligations')}
                className="flex-1 bg-gray-200 text-black py-3 rounded-lg font-medium hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700"
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
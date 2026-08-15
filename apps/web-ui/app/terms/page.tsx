import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
        <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
          <p><strong>Last updated:</strong> February 2026</p>

          <h2 className="text-lg font-semibold text-white mt-8">1. Acceptance of Terms</h2>
          <p>By accessing or using the Product Recall Tracker (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2 className="text-lg font-semibold text-white mt-8">2. Description of Service</h2>
          <p>The Service provides AI-assisted identification of FDA and CPSC product recalls affecting your supply chain based on product categories, company activities, and distribution regions. The Service is for informational purposes only and does not constitute legal, compliance, or professional advice.</p>

          <h2 className="text-lg font-semibold text-white mt-8">3. No Guarantee of Accuracy</h2>
          <p>Recall information is identified using AI analysis and may not be complete or fully accurate. Results should be verified against official FDA and CPSC sources before relying on them for recall response decisions. We are not responsible for any regulatory actions, fines, or penalties resulting from reliance on Service output.</p>

          <h2 className="text-lg font-semibold text-white mt-8">4. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration.</p>

          <h2 className="text-lg font-semibold text-white mt-8">5. Acceptable Use</h2>
          <p>You agree not to misuse the Service, including but not limited to: automated scraping, excessive API usage, or attempting to circumvent access controls.</p>

          <h2 className="text-lg font-semibold text-white mt-8">6. Data and Privacy</h2>
          <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.</p>

          <h2 className="text-lg font-semibold text-white mt-8">7. Limitation of Liability</h2>
          <p>The Service is provided &ldquo;as is&rdquo; without warranties of any kind. In no event shall we be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>

          <h2 className="text-lg font-semibold text-white mt-8">8. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the Service constitutes acceptance of updated terms.</p>

          <h2 className="text-lg font-semibold text-white mt-8">9. Contact</h2>
          <p>Questions about these terms may be directed to our support team.</p>
        </div>
      </div>
    </div>
  );
}

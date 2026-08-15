import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
        <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
          <p><strong>Last updated:</strong> February 2026</p>

          <h2 className="text-lg font-semibold text-white mt-8">1. Information We Collect</h2>
          <p><strong>Account information:</strong> Email address and password (hashed) when you create an account.</p>
          <p><strong>Company information:</strong> Company name, website URL, NAICS code, employee count, and state — provided during the discovery process.</p>
          <p><strong>Usage data:</strong> Compliance status selections, notes, due dates, and uploaded documents that you choose to store in the Service.</p>

          <h2 className="text-lg font-semibold text-white mt-8">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Identify relevant product recalls from FDA and CPSC databases</li>
            <li>Provide recall tracking and response management features</li>
            <li>Store your recall response data (notes, documents, status) for your ongoing use</li>
            <li>Improve the accuracy of our AI analysis</li>
          </ul>

          <h2 className="text-lg font-semibold text-white mt-8">3. AI Processing</h2>
          <p>Company information is sent to AI models (Anthropic Claude) to analyze recall relevance to your supply chain. This data is used solely for generating your recall analysis results and is not used to train AI models.</p>

          <h2 className="text-lg font-semibold text-white mt-8">4. Data Storage</h2>
          <p>Your data is stored on AWS infrastructure (RDS PostgreSQL, S3) in the US West (Oregon) region. Uploaded documents are stored in encrypted S3 buckets. Database connections use SSL encryption.</p>

          <h2 className="text-lg font-semibold text-white mt-8">5. Data Sharing</h2>
          <p>We do not sell your data. We do not share your data with third parties except as required to operate the Service (cloud infrastructure providers) or as required by law.</p>

          <h2 className="text-lg font-semibold text-white mt-8">6. Data Retention</h2>
          <p>Your data is retained as long as your account is active. You may request deletion of your account and associated data by contacting us.</p>

          <h2 className="text-lg font-semibold text-white mt-8">7. Security</h2>
          <p>We use industry-standard security measures including encrypted passwords (bcrypt), SSL database connections, presigned URLs for document access, and server-side API key storage.</p>

          <h2 className="text-lg font-semibold text-white mt-8">8. Your Rights</h2>
          <p>You may access, update, or delete your data at any time through the Service or by contacting us.</p>

          <h2 className="text-lg font-semibold text-white mt-8">9. Changes</h2>
          <p>We may update this policy from time to time. We will notify registered users of material changes via email.</p>

          <h2 className="text-lg font-semibold text-white mt-8">10. Contact</h2>
          <p>Privacy questions may be directed to our support team.</p>
        </div>
      </div>
    </div>
  );
}

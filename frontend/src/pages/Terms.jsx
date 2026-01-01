import { Link } from 'react-router-dom';

function Terms() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: January 1, 2025</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              Welcome to SayIt OwnIt, operated by Ubinator Software Solutions LLP ("Company," "we,"
              "our," or "us"). By accessing or using our website at
              <a href="https://www.sayitownit.com" className="text-blue-600 hover:underline mx-1">www.sayitownit.com</a>
              (the "Service"), you agree to be bound by these Terms of Service ("Terms").
            </p>
            <p className="text-gray-700">
              If you do not agree to these Terms, you must not access or use the Service. We reserve
              the right to modify these Terms at any time. Your continued use of the Service following
              any changes constitutes acceptance of those changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700">
              SayIt OwnIt is a platform that tracks, aggregates, and analyzes stock market
              recommendations made by experts on Indian financial television channels. We extract
              recommendations from publicly available video content using automated systems and
              present them in an organized, searchable format. The Service includes features such
              as expert profiles, stock tracking, performance analytics, and portfolio simulations.
            </p>
          </section>

          <section className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Important Disclaimer - Not Investment Advice</h2>
            <p className="text-gray-700 mb-4">
              <strong>THE SERVICE IS FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY.</strong>
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>We are NOT a registered investment advisor, broker, or financial planner.</li>
              <li>The recommendations displayed are sourced from third-party experts on television programs and are NOT our own recommendations.</li>
              <li>We make no guarantee about the accuracy, completeness, or reliability of any recommendation or data.</li>
              <li>Past performance of any expert or stock recommendation does not guarantee future results.</li>
              <li>You should consult a qualified financial advisor before making any investment decisions.</li>
              <li>We are not responsible for any financial losses resulting from your use of information on this platform.</li>
            </ul>
            <p className="text-gray-700 mt-4 font-medium">
              BY USING THIS SERVICE, YOU ACKNOWLEDGE THAT ALL INVESTMENT DECISIONS ARE MADE AT YOUR
              OWN RISK AND DISCRETION.
            </p>
          </section>

          <section className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Intellectual Property and Content Restrictions</h2>
            <p className="text-gray-700 mb-4">
              <strong>All content on SayIt OwnIt is protected by intellectual property laws.</strong>
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2 mt-4">4.1 Our Intellectual Property</h3>
            <p className="text-gray-700 mb-4">
              The Service, including its original content, features, functionality, design,
              compilation of data, analytics, user interface, and underlying technology, is owned
              by Ubinator Software Solutions LLP and is protected by copyright, trademark, and other
              intellectual property laws.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2">4.2 Prohibited Uses</h3>
            <p className="text-gray-700 mb-2">You are expressly prohibited from:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Copying or reproducing</strong> any content from the Service for commercial purposes</li>
              <li><strong>Scraping, crawling, or automated extraction</strong> of data from the Service</li>
              <li><strong>Republishing</strong> our content on any other website, application, or platform</li>
              <li><strong>Creating derivative works</strong> based on our content, data, or analytics</li>
              <li><strong>Selling, licensing, or distributing</strong> any content obtained from the Service</li>
              <li><strong>Presenting our content as your own</strong> or misrepresenting its source</li>
              <li><strong>Removing or altering</strong> any copyright, trademark, or attribution notices</li>
              <li><strong>Building competing products</strong> using data obtained from our Service</li>
              <li><strong>Using screenshots or data exports</strong> for commercial redistribution</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-2 mt-4">4.3 Permitted Uses</h3>
            <p className="text-gray-700">
              You may access and view the content for personal, non-commercial purposes. You may
              share links to our pages. Brief quotations with proper attribution to SayIt OwnIt
              are permitted for commentary, criticism, or educational purposes, consistent with
              fair use principles.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-2 mt-4">4.4 Enforcement</h3>
            <p className="text-gray-700">
              We actively monitor for unauthorized use of our content. Violations may result in
              immediate termination of access, legal action, and claims for damages including
              attorney fees.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. User Accounts</h2>
            <p className="text-gray-700 mb-4">
              When you create an account using Google OAuth, you are responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Maintaining the confidentiality of your account</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
            <p className="text-gray-700 mt-4">
              We reserve the right to suspend or terminate accounts that violate these Terms or
              for any other reason at our sole discretion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Acceptable Use Policy</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems or other user accounts</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Use automated systems (bots, scrapers, spiders) to access the Service without permission</li>
              <li>Impersonate any person or entity</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Circumvent any access controls or rate limits</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Third-Party Content</h2>
            <p className="text-gray-700 mb-4">
              The recommendations displayed on our Service are extracted from third-party sources
              (television broadcasts, YouTube videos) and are the opinions of the respective experts.
              We do not endorse, verify, or take responsibility for these recommendations.
            </p>
            <p className="text-gray-700">
              Links to third-party websites (including YouTube) are provided for convenience. We have
              no control over and assume no responsibility for the content, privacy policies, or
              practices of third-party sites.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Data Accuracy Disclaimer</h2>
            <p className="text-gray-700">
              Our content is sourced and curated using automated algorithms from video transcripts
              and other sources. This process is prone to errors. We do not guarantee the accuracy,
              completeness, or timeliness of any data, including stock names, prices, targets,
              recommendations, or expert attributions. You should verify all information independently
              before making any decisions based on it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind.</li>
              <li>We disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.</li>
              <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages.</li>
              <li>We are not responsible for lost profits, revenues, data, or financial losses.</li>
              <li>Our total liability for any claims shall not exceed the amount you paid for the Service (if any) in the 12 months preceding the claim.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Indemnification</h2>
            <p className="text-gray-700">
              You agree to indemnify, defend, and hold harmless Ubinator Software Solutions LLP,
              its officers, directors, employees, and agents from any claims, damages, losses,
              liabilities, and expenses (including attorney fees) arising from your use of the
              Service, violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Termination</h2>
            <p className="text-gray-700">
              We may terminate or suspend your access to the Service immediately, without prior
              notice or liability, for any reason, including breach of these Terms. Upon termination,
              your right to use the Service ceases immediately. Provisions that by their nature
              should survive termination shall survive, including intellectual property rights,
              disclaimers, and limitations of liability.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Changes to Service</h2>
            <p className="text-gray-700">
              We reserve the right to modify, suspend, or discontinue any aspect of the Service
              at any time without notice. We shall not be liable to you or any third party for
              any modification, suspension, or discontinuation of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Governing Law and Jurisdiction</h2>
            <p className="text-gray-700">
              These Terms shall be governed by and construed in accordance with the laws of India,
              without regard to conflict of law principles. Any disputes arising from these Terms
              or your use of the Service shall be subject to the exclusive jurisdiction of the
              courts located in Noida, Uttar Pradesh, India.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">14. Severability</h2>
            <p className="text-gray-700">
              If any provision of these Terms is found to be unenforceable or invalid, that
              provision shall be limited or eliminated to the minimum extent necessary, and the
              remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">15. Entire Agreement</h2>
            <p className="text-gray-700">
              These Terms, together with our Privacy Policy, constitute the entire agreement
              between you and Ubinator Software Solutions LLP regarding the Service and supersede
              all prior agreements, communications, and understandings.
            </p>
          </section>

          <section className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">16. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="text-gray-700 space-y-2">
              <p><strong>Ubinator Software Solutions LLP</strong></p>
              <p>A502 Shaurya, Sector 62</p>
              <p>Noida - 201301, UP, India</p>
              <p className="mt-3"><strong>Email:</strong> support@sayitownit.com</p>
              <p><strong>Website:</strong> <a href="https://www.sayitownit.com" className="text-blue-600 hover:underline">www.sayitownit.com</a></p>
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link to="/privacy-policy" className="text-blue-600 hover:underline">
            View Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Terms;

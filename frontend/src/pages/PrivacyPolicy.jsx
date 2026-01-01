import { Link } from 'react-router-dom';

function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: January 1, 2025</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Welcome to SayIt OwnIt ("we," "our," or "us"). We operate the website
              <a href="https://www.sayitownit.com" className="text-blue-600 hover:underline mx-1">www.sayitownit.com</a>
              (the "Service"), a platform that tracks and analyzes stock market recommendations
              from Indian financial television channels.
            </p>
            <p className="text-gray-700">
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you visit our website. Please read this policy carefully. By using
              the Service, you agree to the collection and use of information in accordance with
              this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Account Information:</strong> When you sign in using Google OAuth, we receive your name, email address, and profile picture from Google.</li>
              <li><strong>User Preferences:</strong> Your watchlist, followed experts, and portfolio simulation data.</li>
              <li><strong>Communications:</strong> Any feedback, inquiries, or correspondence you send to us.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
              <li><strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers.</li>
              <li><strong>Usage Data:</strong> Pages visited, time spent on pages, click patterns, and navigation paths.</li>
              <li><strong>Cookies and Tracking:</strong> We use cookies, web beacons, and similar technologies to enhance your experience and collect analytics data.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>To provide and maintain our Service</li>
              <li>To personalize your experience and deliver content relevant to your interests</li>
              <li>To manage your account and user preferences</li>
              <li>To analyze usage patterns and improve our Service</li>
              <li>To communicate with you about updates, features, and support</li>
              <li>To detect, prevent, and address technical issues or fraudulent activity</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Promotional and Advertising Use</h2>
            <p className="text-gray-700 mb-4">
              <strong>Important:</strong> By using our Service, you acknowledge and agree that your
              information may be used for promotional and advertising purposes, including but not
              limited to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Targeted Advertising:</strong> We may share anonymized or aggregated data with advertising platforms such as Google Ads, Facebook Ads, and similar services to deliver relevant advertisements.</li>
              <li><strong>Remarketing:</strong> We use remarketing services to show advertisements on third-party websites to users who have previously visited our Service.</li>
              <li><strong>Analytics:</strong> We share data with analytics providers to understand user behavior and improve our marketing efforts.</li>
              <li><strong>Promotional Communications:</strong> We may send you promotional emails about new features, recommendations, or market insights (you can opt out at any time).</li>
            </ul>
            <p className="text-gray-700 mt-4">
              We work with third-party advertising partners including Google, Facebook (Meta), and
              other ad networks. These partners may use cookies and similar technologies to collect
              information about your browsing activity across websites.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Information Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">We may share your information in the following situations:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Service Providers:</strong> With third-party vendors who assist us in operating our Service (hosting, analytics, advertising).</li>
              <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental authority.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
              <li><strong>With Your Consent:</strong> When you have given explicit consent for specific sharing.</li>
            </ul>
            <p className="text-gray-700 mt-4">
              We do not sell your personal information to third parties for their direct marketing
              purposes without your explicit consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 mb-4">We use the following types of cookies:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for the website to function properly.</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website.</li>
              <li><strong>Advertising Cookies:</strong> Used to deliver relevant advertisements and track campaign performance.</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences.</li>
            </ul>
            <p className="text-gray-700 mt-4">
              You can control cookie settings through your browser. However, disabling certain cookies
              may limit your ability to use some features of our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="text-gray-700">
              We retain your personal information for as long as your account is active or as needed
              to provide you services. We may retain certain information as required by law or for
              legitimate business purposes, including analytics and record-keeping. Usage data is
              typically retained for shorter periods unless used for security purposes or to improve
              our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Data Security</h2>
            <p className="text-gray-700">
              We implement appropriate technical and organizational security measures to protect your
              personal information against unauthorized access, alteration, disclosure, or destruction.
              However, no method of transmission over the Internet or electronic storage is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Your Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of promotional communications</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise these rights, please contact us at the email address provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Third-Party Links</h2>
            <p className="text-gray-700">
              Our Service may contain links to third-party websites, including YouTube videos and
              external financial resources. We are not responsible for the privacy practices of these
              external sites. We encourage you to review the privacy policies of any third-party
              sites you visit.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Children's Privacy</h2>
            <p className="text-gray-700">
              Our Service is not intended for users under the age of 18. We do not knowingly collect
              personal information from children. If you are a parent or guardian and believe your
              child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new policy on this page and updating the "Last updated" date. Your
              continued use of the Service after any changes constitutes acceptance of the updated
              policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
            <p className="text-gray-700">
              This Privacy Policy is governed by the laws of India. Any disputes arising from this
              policy shall be subject to the exclusive jurisdiction of the courts in India.
            </p>
          </section>

          <section className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">14. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have any questions about this Privacy Policy, please contact us:
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
          <Link to="/terms" className="text-blue-600 hover:underline">
            View Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

/**
 * Expert Profile Enrichment Service
 *
 * Uses Gemini AI to research and enrich expert profiles with:
 * - Professional background and experience
 * - Social media handles
 * - Current associations (TV channels, firms)
 * - Education and certifications
 * - Any warnings or red flags (legal issues, controversies)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../config/index.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const RESEARCH_PROMPT = `You are a financial research assistant. Research the following Indian stock market analyst/expert and provide a comprehensive profile.

Expert Name: {EXPERT_NAME}
Context: This person appears on Indian financial TV channels giving stock recommendations.

Please research and provide the following information in JSON format:

{
  "found": true/false,  // Whether you found reliable information about this person
  "confidence": "high"/"medium"/"low",  // Confidence in the accuracy of the information

  "profile": {
    "full_name": "Full official name",
    "profile_picture_url": "URL to their profile picture if available (LinkedIn, Twitter, or official)",
    "title": "Current job title/designation",
    "experience_summary": "Brief 2-3 sentence summary of their experience and expertise",
    "education": "Educational background",
    "certifications": ["List of relevant certifications like CFA, SEBI RIA, CFP, etc."]
  },

  "social_media": {
    "twitter_handle": "@handle or null",
    "linkedin_url": "Full LinkedIn profile URL or null",
    "youtube_channel": "YouTube channel URL if they have one or null",
    "website_url": "Personal/company website or null"
  },

  "associations": {
    "current": ["List of current TV channels, firms, or organizations they're associated with"],
    "past": ["List of notable past associations"]
  },

  "credentials": {
    "sebi_registered": true/false/null,  // Whether they are SEBI registered investment advisor
    "sebi_registration_number": "Registration number if known or null",
    "years_of_experience": number or null
  },

  "warnings": [
    // List any red flags, controversies, or concerns. Include:
    // - Any SEBI actions or warnings
    // - Legal cases or regulatory issues
    // - Controversies or misleading advice allegations
    // - Complaints from investors
    // Format: {"type": "SEBI_ACTION|LEGAL|CONTROVERSY|COMPLAINT", "description": "Brief description", "source": "Where you found this"}
  ],

  "sources": ["List of sources/URLs where you found this information"]
}

IMPORTANT NOTES:
1. If you cannot find reliable information, set "found" to false and provide empty/null values
2. Be factual and objective - do not make up information
3. Prioritize official sources (LinkedIn, company websites, SEBI database, news articles)
4. For warnings, only include verifiable concerns from reputable sources
5. Indian stock market context: Look for associations with channels like Zee Business, CNBC Awaaz, ET Now, CNBC TV18
6. Common certifications to look for: NISM, CFA, CFP, SEBI RIA, SEBI RA

Return ONLY valid JSON, no additional text.`;

export const expertProfileService = {
  /**
   * Research an expert using Gemini AI
   * @param {string} expertName - Name of the expert to research
   * @returns {Object} Research results
   */
  async researchExpert(expertName) {
    try {
      console.log(`[ExpertProfile] Researching expert: ${expertName}`);

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.3,  // Lower temperature for more factual responses
          topP: 0.8,
          maxOutputTokens: 4096
        }
      });

      const prompt = RESEARCH_PROMPT.replace('{EXPERT_NAME}', expertName);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON from response
      let researchData;
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                         text.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, text];
        const jsonStr = jsonMatch[1] || text;
        researchData = JSON.parse(jsonStr.trim());
      } catch (parseError) {
        console.error('[ExpertProfile] Failed to parse Gemini response:', parseError);
        console.log('[ExpertProfile] Raw response:', text);
        return {
          found: false,
          error: 'Failed to parse research results',
          raw_response: text
        };
      }

      console.log(`[ExpertProfile] Research completed for ${expertName}:`,
        researchData.found ? 'Found' : 'Not found',
        `Confidence: ${researchData.confidence || 'unknown'}`);

      return researchData;

    } catch (error) {
      console.error('[ExpertProfile] Error researching expert:', error);
      return {
        found: false,
        error: error.message
      };
    }
  },

  /**
   * Research a pending expert and save results
   * @param {string} pendingExpertId - ID of the pending expert
   * @returns {Object} Updated pending expert with research
   */
  async researchPendingExpert(pendingExpertId) {
    // Get pending expert
    const result = await db.query(
      'SELECT * FROM pending_experts WHERE id = $1',
      [pendingExpertId]
    );

    if (result.rows.length === 0) {
      throw new Error('Pending expert not found');
    }

    const pendingExpert = result.rows[0];

    // Research the expert
    const research = await this.researchExpert(pendingExpert.raw_name);

    // Create summary for admin review
    let summary = '';
    if (research.found) {
      summary = this.createResearchSummary(research);
    } else {
      summary = `No reliable information found for "${pendingExpert.raw_name}". This may be a new analyst or the name may be misspelled.`;
    }

    // Save research results
    await db.query(
      `UPDATE pending_experts
       SET research_summary = $1,
           research_data = $2,
           research_completed_at = NOW()
       WHERE id = $3`,
      [summary, JSON.stringify(research), pendingExpertId]
    );

    return {
      ...pendingExpert,
      research_summary: summary,
      research_data: research,
      research_completed_at: new Date()
    };
  },

  /**
   * Create a human-readable summary from research data
   */
  createResearchSummary(research) {
    const parts = [];

    if (research.profile?.title) {
      parts.push(`**${research.profile.full_name || 'Unknown'}** - ${research.profile.title}`);
    }

    if (research.profile?.experience_summary) {
      parts.push(`\n${research.profile.experience_summary}`);
    }

    if (research.associations?.current?.length > 0) {
      parts.push(`\n**Current Associations:** ${research.associations.current.join(', ')}`);
    }

    if (research.credentials?.sebi_registered) {
      parts.push(`\n**SEBI Registered:** Yes${research.credentials.sebi_registration_number ? ` (${research.credentials.sebi_registration_number})` : ''}`);
    }

    if (research.social_media) {
      const socials = [];
      if (research.social_media.twitter_handle) socials.push(`Twitter: ${research.social_media.twitter_handle}`);
      if (research.social_media.linkedin_url) socials.push('LinkedIn');
      if (research.social_media.youtube_channel) socials.push('YouTube');
      if (socials.length > 0) {
        parts.push(`\n**Social Media:** ${socials.join(', ')}`);
      }
    }

    if (research.warnings?.length > 0) {
      parts.push(`\n\n⚠️ **Warnings (${research.warnings.length}):**`);
      research.warnings.forEach(w => {
        parts.push(`- [${w.type}] ${w.description}`);
      });
    }

    parts.push(`\n\n_Confidence: ${research.confidence || 'unknown'}_`);

    return parts.join('');
  },

  /**
   * Enrich an existing expert's profile
   * @param {string} expertId - ID of the expert
   * @returns {Object} Updated expert
   */
  async enrichExpertProfile(expertId) {
    // Get expert
    const result = await db.query(
      'SELECT * FROM experts WHERE id = $1',
      [expertId]
    );

    if (result.rows.length === 0) {
      throw new Error('Expert not found');
    }

    const expert = result.rows[0];

    // Research the expert
    const research = await this.researchExpert(expert.canonical_name);

    if (!research.found) {
      console.log(`[ExpertProfile] No data found for expert ${expert.canonical_name}`);
      return expert;
    }

    // Update expert profile
    await db.query(
      `UPDATE experts SET
        profile_picture_url = COALESCE($1, profile_picture_url),
        twitter_handle = COALESCE($2, twitter_handle),
        linkedin_url = COALESCE($3, linkedin_url),
        youtube_channel = COALESCE($4, youtube_channel),
        website_url = COALESCE($5, website_url),
        experience_summary = COALESCE($6, experience_summary),
        current_associations = COALESCE($7, current_associations),
        education = COALESCE($8, education),
        certifications = COALESCE($9, certifications),
        warnings = COALESCE($10, warnings),
        profile_enriched_at = NOW(),
        profile_source = 'gemini'
       WHERE id = $11`,
      [
        research.profile?.profile_picture_url,
        research.social_media?.twitter_handle,
        research.social_media?.linkedin_url,
        research.social_media?.youtube_channel,
        research.social_media?.website_url,
        research.profile?.experience_summary,
        research.associations?.current,
        research.profile?.education,
        research.profile?.certifications,
        research.warnings?.map(w => `[${w.type}] ${w.description}`),
        expertId
      ]
    );

    // Return updated expert
    const updated = await db.query('SELECT * FROM experts WHERE id = $1', [expertId]);
    return updated.rows[0];
  },

  /**
   * Get pending experts with research status
   */
  async getPendingExpertsWithResearch() {
    const result = await db.query(`
      SELECT
        pe.*,
        v.title as video_title,
        v.youtube_url
      FROM pending_experts pe
      LEFT JOIN videos v ON pe.video_id = v.id
      WHERE pe.status = 'pending'
      ORDER BY pe.created_at DESC
    `);

    return result.rows;
  }
};

export default expertProfileService;

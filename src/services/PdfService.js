'use strict';

/**
 * Abstract base class for PDF generation services.
 *
 * Subclasses must implement generateConversationReport(data).
 *
 * @typedef {Object} ThemeEntry
 * @property {string} name
 * @property {string} explanation
 * @property {string} quote
 * @property {string} context
 *
 * @typedef {Object} ResourceEntry
 * @property {string} topic
 * @property {string} whyItMatters
 * @property {string} whereToLearnMore
 *
 * @typedef {Object} ReportData
 * @property {string} characterName
 * @property {string} characterTagline
 * @property {string} characterBirthYear
 * @property {string} characterDeathYear
 * @property {string} characterBio
 * @property {string} characterImageUrl
 * @property {string[]} characterFacts
 * @property {string} sessionDate
 * @property {string} sessionDuration
 * @property {string} userName
 * @property {string} sessionSummary
 * @property {string} headlineInsight
 * @property {ThemeEntry[]} themes
 * @property {ResourceEntry[]} resources
 * @property {string[]} reflectionQuestions
 */
class PdfService {
  /**
   * Generate a conversation summary PDF.
   *
   * @param {ReportData} data
   * @returns {Promise<Buffer>} PDF bytes
   */
  async generateConversationReport(data) {
    throw new Error('generateConversationReport() must be implemented by subclass');
  }
}

module.exports = PdfService;

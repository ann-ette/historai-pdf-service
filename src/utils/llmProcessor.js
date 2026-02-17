'use strict';

/**
 * llmProcessor.js
 *
 * Stub implementation — returns hardcoded but realistic Einstein report data.
 * Replace the body of extractReportData() with a real LLM call (e.g. OpenAI,
 * Anthropic Claude) when you're ready to plug in the actual AI layer.
 *
 * @param {object} params
 * @param {string} params.transcript        Raw conversation transcript text
 * @param {string} params.characterName     E.g. "Albert Einstein"
 * @param {object} params.characterMetadata From the API request body
 * @returns {Promise<import('../services/PdfService').ReportData>}
 */
async function extractReportData({ transcript, characterName, characterMetadata }) {
  // ── Derived profile fields from characterMetadata ───────────────────────
  const characterTagline  = characterMetadata.tagline  || 'Theoretical Physicist & Humanitarian';
  const characterBirthYear= characterMetadata.birthYear || '1879';
  const characterDeathYear= characterMetadata.deathYear || '1955';
  const characterBio      = characterMetadata.bio ||
    'Albert Einstein revolutionised our understanding of space, time, and energy ' +
    'with his Special and General Theories of Relativity, earning the 1921 Nobel Prize in Physics.';
  const characterFacts    = characterMetadata.facts || [
    'Born on 14 March 1879 in Ulm, Kingdom of Württemberg, German Empire.',
    'His 1905 "Annus Mirabilis" papers included the Special Theory of Relativity and E=mc².',
    'He was offered the presidency of Israel in 1952 but respectfully declined.',
    'Einstein played the violin throughout his life, calling music his greatest personal pleasure.',
    'He was a pacifist who later co-signed the Russell–Einstein Manifesto against nuclear weapons.',
  ];

  // ── Hardcoded stub content (replace with LLM output) ────────────────────
  const sessionSummary =
    'In this session, the user engaged in a wide-ranging conversation with Albert Einstein, ' +
    'exploring the philosophical underpinnings of modern physics, Einstein\'s personal journey ' +
    'from patent clerk to world-renowned scientist, and his deeply held views on education, ' +
    'imagination, and moral responsibility. The conversation touched on his early struggles ' +
    'in academia, the revolutionary insight behind the Special Theory of Relativity, and his ' +
    'complicated feelings about the atomic bomb—a weapon made possible by his famous equation E=mc².';

  const headlineInsight =
    'Imagination is more important than knowledge—knowledge is limited, but imagination ' +
    'encircles the entire world.';

  const themes = [
    {
      name: 'Relativity and the Nature of Time',
      explanation:
        'Einstein introduced the radical idea that time is not absolute but relative to the ' +
        'observer\'s velocity and gravitational field. The session unpacked how this insight ' +
        'overturned centuries of Newtonian mechanics and reshaped physics forever.',
      quote:
        'Put your hand on a hot stove for a minute and it seems like an hour. Sit with a ' +
        'pretty girl for an hour and it seems like a minute. That\'s relativity.',
      context:
        'Before Einstein published his 1905 paper "On the Electrodynamics of Moving Bodies," ' +
        'physicists assumed a universal, Newtonian "absolute time." His Special Theory of ' +
        'Relativity demonstrated that simultaneity is relative: two events simultaneous for ' +
        'one observer may not be for another moving at a different velocity. This paved the ' +
        'way for GPS technology, particle accelerators, and the entire field of cosmology.',
    },
    {
      name: 'Education, Curiosity, and Imagination',
      explanation:
        'Einstein was famously skeptical of rote learning and examinations. He argued that ' +
        'true education should nurture curiosity and creative thinking rather than drill facts ' +
        'into passive minds. The discussion revealed his belief that wonder is the source of all science.',
      quote:
        'The important thing is not to stop questioning. Curiosity has its own reason for existing.',
      context:
        'Einstein struggled at conventional schools and failed his first entrance exam to the ' +
        'Swiss Federal Polytechnic. Yet this "failure" gave him time to think independently. ' +
        'His unconventional mind thrived in Bern\'s patent office, where evaluating others\' ' +
        'inventions sharpened his ability to spot conceptual inconsistencies—a skill central ' +
        'to developing relativity. His educational philosophy later influenced progressive ' +
        'pedagogy movements worldwide.',
    },
    {
      name: 'Science, Morality, and Nuclear Responsibility',
      explanation:
        'One of the session\'s most moving segments explored Einstein\'s anguish over ' +
        'E=mc²\'s role in enabling nuclear weapons. He believed scientists carry a moral ' +
        'obligation to consider the societal consequences of their discoveries.',
      quote:
        'The release of atomic energy has not created a new problem. It has merely made ' +
        'more urgent the necessity of solving an existing one.',
      context:
        'Einstein\'s 1905 equation E=mc² demonstrated the equivalence of mass and energy, ' +
        'a theoretical cornerstone later exploited in nuclear fission research. Although ' +
        'Einstein himself did not work on the Manhattan Project, he co-signed the 1939 ' +
        'Einstein–Szilárd letter warning President Roosevelt that Nazi Germany might be ' +
        'developing atomic weapons. He spent his final years advocating for nuclear ' +
        'disarmament and a world government, co-authoring the 1955 Russell–Einstein Manifesto.',
    },
  ];

  const resources = [
    {
      topic: 'Special Theory of Relativity',
      whyItMatters:
        'Fundamentally changed how we understand space, time, and energy; underlies GPS, ' +
        'nuclear energy, and modern particle physics.',
      whereToLearnMore:
        'Einstein\'s original 1905 paper (freely available via Annalen der Physik); ' +
        '"Relativity: The Special and the General Theory" by Einstein (Penguin Classics).',
    },
    {
      topic: 'Philosophy of Science',
      whyItMatters:
        'Understanding how scientists think about theory, evidence, and creativity helps ' +
        'everyone evaluate claims critically in a complex information landscape.',
      whereToLearnMore:
        '"The World As I See It" by Albert Einstein; "Philosophy of Physics" by Tim Maudlin ' +
        '(Princeton University Press).',
    },
    {
      topic: 'Nuclear Age & Arms Control',
      whyItMatters:
        'The existence of thousands of nuclear warheads remains one of humanity\'s greatest ' +
        'existential risks; understanding their history informs modern disarmament efforts.',
      whereToLearnMore:
        '"The Making of the Atomic Bomb" by Richard Rhodes (Pulitzer Prize winner); ' +
        'The Bulletin of the Atomic Scientists (thebulletin.org).',
    },
  ];

  const reflectionQuestions = [
    'Einstein reshaped physics by questioning assumptions everyone else took for granted. ' +
    'What assumptions in your own field or daily life might be worth questioning?',
    'He believed imagination outranks knowledge. Do you agree? How do you personally ' +
    'balance creative thinking with factual grounding?',
    'Einstein anguished over E=mc² enabling nuclear weapons. If you made a discovery with ' +
    'potential for misuse, how would you decide whether—and how—to share it?',
    'He struggled in conventional education yet became history\'s most celebrated scientist. ' +
    'What does his story suggest about how we define and measure intelligence?',
    'Einstein advocated for a world government to prevent war. How do you think ' +
    'international cooperation should be structured to address today\'s global threats?',
  ];

  // ── Assemble and return the full report data object ──────────────────────
  return {
    characterName,
    characterTagline,
    characterBirthYear,
    characterDeathYear,
    characterBio,
    characterFacts,
    sessionSummary,
    headlineInsight,
    themes,
    resources,
    reflectionQuestions,
  };
}

module.exports = { extractReportData };

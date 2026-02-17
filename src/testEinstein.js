'use strict';

/**
 * testEinstein.js
 *
 * Quick integration test — calls the local server with Einstein data and
 * writes the returned PDF to output/einstein-report.pdf.
 *
 * Usage:
 *   node src/testEinstein.js
 *
 * Make sure the server is running first:
 *   npm start        (or npm run dev)
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'einstein-report.pdf');

const EINSTEIN_PAYLOAD = {
  transcript: `
User: Professor Einstein, what was the single moment when you knew relativity was right?
Einstein: It was not a single moment — it was a kind of stubbornness. I could not accept that
the speed of light would behave differently depending on who observed it. If the laws of
physics are truly universal, then the speed of light must be constant. Everything else
— time, length, simultaneity — had to be flexible to accommodate that fact.
User: That sounds like you were willing to sacrifice our common sense understanding of the world.
Einstein: Common sense is the collection of prejudices acquired by age eighteen. Science requires
that we question those prejudices. Yes, I was willing to let go of absolute time — because
the universe does not owe us comfort.
User: Did it trouble you that E=mc² eventually contributed to the bomb?
Einstein: It troubles me deeply — even now. I signed the letter to Roosevelt because I feared
the Germans would build it first. But I never worked on the bomb, and I have spent much
of my later life urging disarmament. The equation is not evil; it is a description of nature.
The evil lies in human choices, and that is why I believe we need international law and
cooperation, not merely scientific progress.
  `.trim(),

  characterName:    'Albert Einstein',
  characterImageUrl:'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/220px-Albert_Einstein_Head.jpg',

  characterMetadata: {
    tagline:   'Theoretical Physicist & Humanitarian',
    birthYear: '1879',
    deathYear: '1955',
    bio: 'Albert Einstein forever changed science with his Special and General Theories of ' +
         'Relativity, earning the 1921 Nobel Prize in Physics for his discovery of the law of ' +
         'the photoelectric effect.',
    facts: [
      'Born 14 March 1879 in Ulm, Kingdom of Württemberg, German Empire.',
      'His 1905 "Annus Mirabilis" produced four landmark papers in a single year.',
      'He declined an offer to become the second President of Israel in 1952.',
      'Einstein played violin throughout his life; Mozart was his favourite composer.',
      'He co-signed the Russell–Einstein Manifesto in 1955, calling for nuclear disarmament.',
    ],
  },

  sessionDate:     'February 17, 2026',
  sessionDuration: '28 minutes',
  userName:        'HistorAI Tester',
};

async function run() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`[test] Created output directory: ${OUTPUT_DIR}`);
  }

  console.log(`[test] Sending request to ${SERVER_URL}/api/generate-report …`);

  let response;
  try {
    response = await axios.post(
      `${SERVER_URL}/api/generate-report`,
      EINSTEIN_PAYLOAD,
      {
        headers:      { 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout:      45000,
      }
    );
  } catch (err) {
    if (err.response) {
      const body = Buffer.from(err.response.data).toString('utf-8');
      console.error(`[test] Server responded with HTTP ${err.response.status}:`);
      console.error(body);
    } else {
      console.error(`[test] Request failed: ${err.message}`);
      console.error('[test] Is the server running?  npm start');
    }
    process.exit(1);
  }

  const pdfBuffer = Buffer.from(response.data);
  fs.writeFileSync(OUTPUT_FILE, pdfBuffer);
  console.log(`[test] PDF saved → ${OUTPUT_FILE} (${pdfBuffer.length} bytes)`);
}

run();

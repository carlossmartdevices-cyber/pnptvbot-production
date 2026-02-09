const https = require('https');
const path = require('path');

// Load .env so QATouch credentials are available even when not in shell env
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (e) { /* dotenv optional */ }

/**
 * Jest custom reporter that pushes test results to QA Touch API.
 *
 * Env vars:
 *   QATOUCH_ENABLED       – "true" to enable
 *   QATOUCH_DOMAIN        – QA Touch workspace domain (e.g. "easybots")
 *   QATOUCH_API_TOKEN     – API token
 *   QATOUCH_PROJECT_KEY   – project key (e.g. "Gl5X")
 *   QATOUCH_TEST_RUN_ID   – test run id (e.g. "hRgQqK")
 *
 * Test titles must contain a QA Touch case key in brackets, e.g.:
 *   it('[M6DR7] should create a payment', ...)
 *
 * Status mapping:  pass → 1,  fail → 2,  skip/pending → 3
 */
class QATouchReporter {
  constructor(globalConfig, reporterOptions) {
    this._globalConfig = globalConfig;
    this._options = reporterOptions;
  }

  async onRunComplete(contexts, results) {
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.QATOUCH_ENABLED !== 'true') return;

    const domain = process.env.QATOUCH_DOMAIN;
    const apiToken = process.env.QATOUCH_API_TOKEN;
    const projectKey = process.env.QATOUCH_PROJECT_KEY;
    const testRunId = process.env.QATOUCH_TEST_RUN_ID;

    if (!domain || !apiToken || !projectKey || !testRunId) {
      console.log('[QATouch] Missing config, skipping result sync.');
      return;
    }

    // Collect cases from test results
    const caseRegex = /\[([A-Za-z0-9]+)\]/;
    const cases = {};
    let idx = 0;

    for (const suite of results.testResults) {
      for (const test of suite.testResults) {
        const match = test.title.match(caseRegex);
        if (!match) continue;

        const caseKey = match[1];
        let status;
        if (test.status === 'passed') status = 1;
        else if (test.status === 'failed') status = 2;
        else status = 3; // skipped/pending

        cases[String(idx)] = { case: caseKey, status };
        idx++;
      }
    }

    if (idx === 0) {
      console.log('[QATouch] No tagged test cases found, skipping.');
      return;
    }

    const casesJson = JSON.stringify(cases);
    const path = `/api/v1/runresult/updatestatus/multiple?project=${projectKey}&test_run=${testRunId}&cases=${encodeURIComponent(casesJson)}`;

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'api.qatouch.com',
          port: 443,
          path,
          method: 'POST',
          headers: {
            'api-token': apiToken,
            domain,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            console.log(`[QATouch] Synced ${idx} results → HTTP ${res.statusCode}`);
            if (res.statusCode >= 400) {
              console.log(`[QATouch] Response: ${body}`);
            }
            resolve();
          });
        }
      );

      req.on('error', (err) => {
        console.log(`[QATouch] Error: ${err.message}`);
        resolve(); // don't fail the test run
      });

      req.end();
    });
  }
}

module.exports = QATouchReporter;

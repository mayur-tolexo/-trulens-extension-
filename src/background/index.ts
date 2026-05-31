import { runDeepAnalysis, runBatchAnalysis, testConnection } from './llm';
import { getCached, setCached, clearCache } from './cache';
import { getSettings, setSettings } from './settings';

// Open the onboarding/options page on first install only (not on update or reload).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'deepAnalysisBatch') {
        const reviews = msg.reviews ?? [];
        const out: any[] = [];
        const toRun: any[] = [];
        for (const rv of reviews) {
          const cached = await getCached(rv.text);
          if (cached) out.push({ id: rv.id, ...cached });
          else toRun.push(rv);
        }
        if (toRun.length) {
          const results = await runBatchAnalysis(toRun, msg.siblings ?? []);
          for (let i = 0; i < toRun.length; i++) {
            const r = results[i] ?? { score: 50, verdict: 'mixed', reasoning: '' };
            await setCached(toRun[i].text, r);
            out.push({ id: toRun[i].id, ...r });
          }
        }
        return sendResponse({ ok: true, results: out });
      }
      if (msg.type === 'deepAnalysis') {
        const cached = await getCached(msg.review.text);
        if (cached) return sendResponse({ ok: true, result: cached, cached: true });
        const result = await runDeepAnalysis(msg.review, msg.siblings ?? []);
        await setCached(msg.review.text, result);
        return sendResponse({ ok: true, result });
      }
      if (msg.type === 'testConnection') return sendResponse(await testConnection());
      if (msg.type === 'getSettings') return sendResponse({ ok: true, settings: await getSettings() });
      if (msg.type === 'setSettings') return sendResponse({ ok: true, settings: await setSettings(msg.patch) });
      if (msg.type === 'clearCache') { await clearCache(); return sendResponse({ ok: true }); }
      sendResponse({ ok: false, error: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true; // async
});

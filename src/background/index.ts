import { runDeepAnalysis, testConnection } from './llm';
import { getCached, setCached } from './cache';
import { getSettings, setSettings } from './settings';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
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
      sendResponse({ ok: false, error: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true; // async
});

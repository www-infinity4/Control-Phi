(function (global) {
  'use strict';

  const KEYS = {
    queue: 'controlPhi:ingestQueue:v1',
    shared: 'phiShared:collection:v1',
    config: 'controlPhi:searchConfig:v1'
  };

  const clean = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const safeJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const saveJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };
  const hash = (value) => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };

  function urlsFrom(value) {
    return clean(value).match(/https?:\/\/[^\s<>'\"]+/gi) || [];
  }

  function xIdentity(url) {
    const match = String(url || '').match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/status\/(\d+)/i);
    return match ? { network: 'x', author: match[1], statusId: match[2] } : null;
  }

  function removeUrls(value) {
    return clean(value).replace(/https?:\/\/[^\s<>'\"]+/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  function titleFor(input, body, identity) {
    const supplied = clean(input.title);
    if (supplied && !/^https?:\/\//i.test(supplied) && supplied.length > 5) return supplied.slice(0, 180);
    const sentence = body.split(/(?<=[.!?])\s+/)[0] || '';
    if (sentence.length >= 12) return sentence.slice(0, 180);
    if (identity) return `Post by @${identity.author}`;
    return 'Shared research item';
  }

  function termsFrom(value, limit) {
    const stop = new Set(['about','after','again','also','and','are','because','before','being','from','have','into','more','news','post','shared','source','that','their','these','they','this','through','what','when','where','which','with','would','your','https','http']);
    const counts = new Map();
    (clean(value).toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || []).forEach((word, index) => {
      if (stop.has(word) || /^\d+$/.test(word)) return;
      counts.set(word, (counts.get(word) || 0) + (index < 16 ? 2 : 1));
    });
    return [...counts].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, limit || 8).map(([word]) => word);
  }

  function questionsFor(title, body) {
    const terms = termsFrom(`${title} ${body}`, 6);
    const subject = terms.slice(0, 3).join(' ') || clean(title) || 'this subject';
    return [
      `What exactly is being reported or claimed about ${subject}?`,
      `What primary or independent sources support the main points about ${subject}?`,
      `What background is needed to understand ${subject}?`,
      `What has changed recently about ${subject}?`,
      `What related questions or developments should be researched next?`
    ];
  }

  function normalize(input) {
    const rawText = clean(input && input.text);
    const suppliedUrl = clean(input && input.url);
    const foundUrls = [...new Set([suppliedUrl, ...urlsFrom(rawText)].filter(Boolean))];
    const sourceUrl = foundUrls[0] || '';
    const identity = xIdentity(sourceUrl);
    const body = removeUrls(rawText);
    const title = titleFor(input || {}, body, identity);
    const meaningful = body.length >= 24;
    return {
      id: `phi-${Date.now().toString(36)}-${hash(`${title}|${body}|${sourceUrl}`)}`,
      type: (input && input.type) || (identity ? 'x-post' : sourceUrl ? 'url' : 'text'),
      title,
      text: body,
      url: sourceUrl,
      urls: foundUrls,
      x: identity,
      source: clean(input && input.source) || 'share',
      collectedAt: new Date().toISOString(),
      terms: termsFrom(`${title} ${body}`, 10),
      questions: questionsFor(title, body),
      searchText: clean(`${title} ${body}`),
      needsResolution: Boolean(sourceUrl && !meaningful),
      readyForCard: meaningful
    };
  }

  function publishCard(record) {
    if (!record || !record.readyForCard) return false;
    const cards = safeJson(KEYS.shared, []);
    const card = {
      id: record.id,
      storyKey: record.id,
      title: record.title,
      extract: record.text,
      body: record.text,
      url: record.url,
      domain: record.x ? `X / @${record.x.author}` : 'Shared research',
      provider: record.x ? 'X' : 'Shared research',
      searchQuery: record.searchText,
      questions: record.questions,
      collectedAt: record.collectedAt,
      ingestType: record.type,
      sourceFingerprint: hash(`${record.url}|${record.text}`)
    };
    const existing = cards.findIndex((item) => item.sourceFingerprint === card.sourceFingerprint || (item.url && item.url === card.url && item.extract === card.extract));
    if (existing >= 0) cards[existing] = { ...cards[existing], ...card };
    else cards.unshift(card);
    saveJson(KEYS.shared, cards.slice(0, 500));
    global.dispatchEvent(new CustomEvent('phi:ingested', { detail: card }));
    return card;
  }

  function enqueue(record) {
    const queue = safeJson(KEYS.queue, []);
    const duplicate = queue.find((item) => item.url && record.url && item.url === record.url && item.text === record.text);
    if (!duplicate) queue.unshift(record);
    saveJson(KEYS.queue, queue.slice(0, 500));
    return record;
  }

  function ingest(input) {
    const record = normalize(input || {});
    enqueue(record);
    if (record.readyForCard) publishCard(record);
    return record;
  }

  async function ingestClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('Clipboard read is unavailable in this browser.');
    const text = await navigator.clipboard.readText();
    if (!clean(text)) throw new Error('Clipboard is empty.');
    return ingest({ text, source: 'clipboard' });
  }

  function ingestShareTarget(search) {
    const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || location.search);
    if (!params.has('shareTarget') && !params.has('text') && !params.has('url')) return null;
    return ingest({
      title: params.get('title') || '',
      text: [params.get('text') || '', params.get('url') || ''].filter(Boolean).join(' '),
      url: params.get('url') || '',
      source: 'android-share-target'
    });
  }

  function pending() { return safeJson(KEYS.queue, []).filter((item) => item.needsResolution); }

  global.PhiIngest = Object.freeze({
    normalize,
    ingest,
    ingestClipboard,
    ingestShareTarget,
    publishCard,
    pending,
    xIdentity,
    keys: { ...KEYS }
  });
})(window);

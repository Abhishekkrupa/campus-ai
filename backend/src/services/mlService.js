// Content-based recommendation logic (TF-IDF + cosine similarity) with a
// local fallback implementation. Can call the external ML service if
// available, otherwise computes recommendations in-process.

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const STOP = new Set('the and for not this that with from have has was were will would can could should about into over after before during per each more most some'.split(' '));

function tfidf(corpus) {
  const docs = corpus.map((d) => {
    const tokens = tokenize(d).filter((w) => !STOP.has(w));
    const tf = {};
    tokens.forEach((t) => { tf[t] = (tf[t] || 0) + 1; });
    return { tf, total: tokens.length, tokens: new Set(tokens) };
  });
  const df = {};
  docs.forEach((d) => {
    d.tokens.forEach((t) => { df[t] = (df[t] || 0) + 1; });
  });
  const N = docs.length;
  return docs.map((d) => {
    const vec = {};
    Object.keys(d.tf).forEach((t) => {
      const idf = Math.log((1 + N) / (1 + (df[t] || 0))) + 1;
      vec[t] = (d.tf[t] / (d.total || 1)) * idf;
    });
    return vec;
  });
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const k in a) {
    if (b[k]) dot += a[k] * b[k];
    na += a[k] * a[k];
  }
  for (const k in b) nb += b[k] * b[k];
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function recommend(queryText, items, topK = 10) {
  if (!items || items.length === 0) return [];
  const corpus = [queryText, ...items.map((i) => i.text)];
  const vecs = tfidf(corpus);
  const queryVec = vecs[0];
  const scored = [];
  for (let i = 1; i < vecs.length; i++) {
    scored.push({ item: items[i - 1], score: cosine(queryVec, vecs[i]) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function activityVector(activities) {
  const parts = [];
  activities.forEach((a) => {
    if (a.subject) parts.push(a.subject);
    if (a.tags) parts.push(a.tags.join(' '));
    if (a.type) parts.push(a.type);
    if (a.text) parts.push(a.text);
  });
  return parts.join(' ');
}

function hybridUserRecommendation(user, candidates, topK = 10) {
  const query = activityVector([...user.subjects.map((s) => ({ subject: s, type: 'subject' })), ...user.skills.map((s) => ({ text: s, type: 'skill' })), ...(user.interests || [])]);
  return recommend(query, candidates.map((c) => ({ ...c, text: [c.name, c.bio, (c.subjects || []).join(' ')].join(' ') })), topK);
}

module.exports = { recommend, tfidf, cosine, tokenize, activityVector, hybridUserRecommendation };

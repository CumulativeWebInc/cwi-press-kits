/* presskit.js — living press kit live refresh.
 *
 * On each page load, fetches the live CWI freshness manifest
 * (https://cumulativewebinc.github.io/cwi-learn/freshness.json) and re-labels
 * any claim whose id maps to a manifest field path. The 48h rule is mirrored
 * here; test.js pins both copies to the same cases.
 *
 * Failure is graceful: if the fetch fails, build-time labels stay and the
 * live bar says so in plain language. Never blocks render.
 */
(function () {
  'use strict';

  var FRESH_HOURS = 48;
  var MANIFEST_URL = 'https://cumulativewebinc.github.io/cwi-learn/freshness.json';

  function statusFor(observedAt, nowMs) {
    var d = new Date(observedAt);
    if (isNaN(d.getTime())) return null;
    var ageHours = (nowMs - d.getTime()) / 3600000;
    return ageHours <= FRESH_HOURS ? 'fresh' : 'stale';
  }

  function pillHtml(observedAt, nowMs) {
    var d = new Date(observedAt);
    var date = String(observedAt).slice(0, 10);
    var st = statusFor(observedAt, nowMs);
    if (st === 'fresh') return 'FRESH · observed ' + date;
    var ageHours = (nowMs - d.getTime()) / 3600000;
    var days = Math.max(1, Math.round(ageHours / 24));
    return 'STALE · last observed ' + date + ' (' + days + 'd ago)';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function livebar(msg) {
    var el = document.getElementById('livebar');
    if (el) el.textContent = msg;
  }

  function refresh() {
    var mappingEl = document.getElementById('freshness-mapping');
    var mapping = {};
    try { mapping = JSON.parse(mappingEl ? mappingEl.textContent : '{}'); } catch (e) { /* keep empty */ }

    var ids = Object.keys(mapping);
    if (ids.length === 0) {
      livebar('No live-mapped claims on this page — labels below are from build time.');
      return;
    }

    fetch(MANIFEST_URL, { headers: { 'Accept': 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('manifest HTTP ' + res.status);
        return res.json();
      })
      .then(function (manifest) {
        var fields = {};
        (manifest.endpoints || []).forEach(function (ep) {
          (ep.fields || []).forEach(function (f) { fields[f.path] = f; });
        });
        var nowMs = Date.now();
        var updated = 0;
        ids.forEach(function (claimId) {
          var f = fields[mapping[claimId]];
          if (!f || !f.observed_at) return;
          var card = document.querySelector('[data-claim-id="' + claimId + '"]');
          if (!card) return;
          var pill = card.querySelector('[data-pill]');
          if (!pill) return;
          var st = statusFor(f.observed_at, nowMs);
          if (!st) return;
          pill.textContent = pillHtml(f.observed_at, nowMs);
          pill.className = 'pill ' + st;
          updated++;
        });
        var checkedAt = manifest.manifest_checked_at ? String(manifest.manifest_checked_at).slice(0, 16).replace('T', ' ') : 'unknown';
        livebar('Live re-check complete: ' + updated + ' label' + (updated === 1 ? '' : 's') +
          ' refreshed against the freshness manifest (labels recomputed ' + checkedAt + ' UTC).');
      })
      .catch(function (err) {
        livebar('Live re-check unavailable right now (' + esc(err.message || 'network') +
          ') — labels below are from build time and remain honest.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
})();

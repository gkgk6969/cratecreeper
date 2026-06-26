// Dice coefficient string similarity, inlined for content script.
// Same algorithm as the npm `string-similarity` package's compareTwoStrings.

(function () {
  function bigrams(str) {
    const map = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.substr(i, 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  }

  function compareTwoStrings(first, second) {
    if (!first || !second) return 0;
    const a = first.replace(/\s+/g, '');
    const b = second.replace(/\s+/g, '');
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const aBigrams = bigrams(a);
    const bBigrams = bigrams(b);
    let intersection = 0;
    for (const [bg, aCount] of aBigrams) {
      const bCount = bBigrams.get(bg) || 0;
      intersection += Math.min(aCount, bCount);
    }
    return (2 * intersection) / (a.length - 1 + b.length - 1);
  }

  window.CRATE_DIGGER_SIM = { compareTwoStrings };
})();

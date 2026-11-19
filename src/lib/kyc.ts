/**
 * Shared CAC registration-number helpers (server validation + client hint).
 *
 * The format check only proves the number is *plausible*; authenticity is
 * established by the platform reviewer against the uploaded certificate. It
 * still rejects free text such as "wrong" or a handful of digits.
 */

export const CAC_NUMBER_PATTERN = /^(?:(RC|BN|IT|LP|LL)\s+)?\d{5,10}$/;

export function normalizeCacNumber(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^CAC[\s/:-]*/, "")
    .replace(/[-\/.]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(RC|BN|IT|LP|LL)(?=\d)/, "$1 ")
    .trim();
}

export function isValidCacNumber(raw: string) {
  return CAC_NUMBER_PATTERN.test(normalizeCacNumber(raw));
}

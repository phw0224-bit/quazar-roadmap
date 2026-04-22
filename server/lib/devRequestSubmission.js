function normalizeText(value) {
  return `${value || ''}`.trim();
}

const REQUIRED_FIELDS = Object.freeze([
  ['title', '제목'],
  ['description', '본문'],
  ['request_team', '요청팀'],
  ['priority', '우선순위'],
]);

export function getDevRequestSubmissionMissingFields(request = {}) {
  return REQUIRED_FIELDS
    .filter(([key]) => !normalizeText(request?.[key]))
    .map(([, label]) => label);
}

export function isDevRequestReadyToSubmit(request = {}) {
  return getDevRequestSubmissionMissingFields(request).length === 0;
}

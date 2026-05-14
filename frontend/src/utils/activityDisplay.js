const internalActivityTargets = new Set([
  'codex_api::endpoint::responses_websocket',
  'codex_app_server::outgoing_message',
  'codex_otel.log_only',
  'codex_otel.trace_safe',
  'hyper_util::client::legacy::client',
  'hyper_util::client::legacy::connect::http',
  'hyper_util::client::legacy::pool',
  'opentelemetry-otlp',
  'opentelemetry_sdk'
]);

const internalActivityPatterns = [
  /^codex_otel\./i,
  /^hyper_util::/i,
  /^opentelemetry/i
];

export function isInternalActivity(entryOrTarget) {
  const target = typeof entryOrTarget === 'string' ? entryOrTarget : entryOrTarget?.target;
  if (!target) return false;
  return internalActivityTargets.has(target) || internalActivityPatterns.some((pattern) => pattern.test(target));
}

export function prettifyActivityTarget(target = '') {
  return target
    .replaceAll('_', ' ')
    .replaceAll('::', ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function activityDisplay(entry) {
  const target = entry?.target || '';
  const message = entry?.message || '';
  const text = `${target} ${message}`.toLowerCase();

  if (!target) {
    return { title: 'Codex event', detail: 'General runtime signal', group: 'runtime' };
  }

  if (isInternalActivity(target)) {
    return { title: 'Runtime telemetry', detail: prettifyActivityTarget(target), group: 'internal' };
  }

  if (/(tool|exec|command|shell|terminal|powershell|bash|cmd|spawn)/i.test(text)) {
    return { title: 'Tool activity', detail: prettifyActivityTarget(target), group: 'tool' };
  }

  if (/(file|patch|write|edit|modified|created|deleted|rename)/i.test(text)) {
    return { title: 'Workspace change', detail: prettifyActivityTarget(target), group: 'workspace' };
  }

  if (/(session|thread|conversation)/i.test(text)) {
    return { title: 'Session signal', detail: prettifyActivityTarget(target), group: 'session' };
  }

  if (/(approval|approve|permission|sandbox|policy|denied|blocked)/i.test(text)) {
    return { title: 'Approval boundary', detail: prettifyActivityTarget(target), group: 'boundary' };
  }

  return { title: prettifyActivityTarget(target), detail: 'Codex activity signal', group: 'runtime' };
}

export function visibleCodexActivity(activity = []) {
  return activity.filter((entry) => !isInternalActivity(entry));
}

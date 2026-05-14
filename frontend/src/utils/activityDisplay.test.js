import { describe, expect, it } from 'vitest';
import { activityDisplay, isInternalActivity, visibleCodexActivity } from './activityDisplay.js';

describe('activityDisplay', () => {
  it('detects internal runtime telemetry targets', () => {
    expect(isInternalActivity({ target: 'opentelemetry_sdk' })).toBe(true);
    expect(isInternalActivity({ target: 'codex_otel.trace_safe' })).toBe(true);
    expect(isInternalActivity({ target: 'hyper_util::client::legacy::pool' })).toBe(true);
    expect(isInternalActivity({ target: 'Project file edited' })).toBe(false);
  });

  it('keeps high-level Codex activity visible', () => {
    const entries = [
      { target: 'opentelemetry_sdk' },
      { target: 'codex_otel.trace_safe' },
      { target: 'Project file edited' }
    ];

    expect(visibleCodexActivity(entries)).toEqual([{ target: 'Project file edited' }]);
  });

  it('classifies workspace and tool signals with friendly labels', () => {
    expect(activityDisplay({ target: 'Project file edited' })).toMatchObject({
      title: 'Workspace change',
      group: 'workspace'
    });
    expect(activityDisplay({ target: 'shell command executed' })).toMatchObject({
      title: 'Tool activity',
      group: 'tool'
    });
  });
});

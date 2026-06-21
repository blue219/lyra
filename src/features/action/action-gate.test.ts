import { describe, expect, test, vi } from 'vitest';

import { createToolbarActionGate } from './action-gate';

describe('createToolbarActionGate', () => {
  test('disables the action by default and registers a Spotify declarative rule', async () => {
    const disable = vi.fn();
    const removeRules = vi.fn((_ruleIdentifiers, callback: () => void) => callback());
    const addRules = vi.fn();
    const showAction = { type: 'show-action' };
    const pageStateMatcher = { type: 'spotify-page-matcher' };
    const ShowAction = vi.fn(function ShowAction() {
      return showAction;
    });
    const PageStateMatcher = vi.fn(function PageStateMatcher() {
      return pageStateMatcher;
    });
    const gate = createToolbarActionGate({
      action: {
        disable,
      },
      declarativeContent: {
        onPageChanged: {
          removeRules,
          addRules,
        },
        ShowAction,
        PageStateMatcher,
      },
    });

    await gate.start();

    expect(disable).toHaveBeenCalledWith();
    expect(removeRules).toHaveBeenCalledWith(undefined, expect.any(Function));
    expect(addRules).toHaveBeenCalledWith([
      {
        conditions: [pageStateMatcher],
        actions: [showAction],
      },
    ]);
  });

  test('matches Spotify Web Player pages only', async () => {
    const addRules = vi.fn();
    const pageStateMatcher = vi.fn(function PageStateMatcher(matcher) {
      return matcher;
    });
    const gate = createToolbarActionGate({
      action: {
        disable: vi.fn(),
      },
      declarativeContent: {
        onPageChanged: {
          removeRules: vi.fn((_ruleIdentifiers, callback: () => void) => callback()),
          addRules,
        },
        ShowAction: vi.fn(function ShowAction() {
          return {};
        }),
        PageStateMatcher: pageStateMatcher,
      },
    });

    await gate.start();

    expect(pageStateMatcher).toHaveBeenCalledWith({
      pageUrl: {
        hostEquals: 'open.spotify.com',
        schemes: ['https'],
      },
    });
  });
});

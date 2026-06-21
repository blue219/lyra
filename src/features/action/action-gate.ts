interface ToolbarActionApi {
  disable: (tabId?: number) => void | Promise<void>;
}

interface DeclarativeRule {
  conditions: unknown[];
  actions: unknown[];
}

interface DeclarativeContentApi {
  onPageChanged: {
    removeRules: (
      ruleIdentifiers: undefined,
      callback: () => void,
    ) => void;
    addRules: (rules: DeclarativeRule[]) => void;
  };
  ShowAction: new () => unknown;
  PageStateMatcher: new (options: {
    pageUrl: {
      hostEquals: string;
      schemes: string[];
    };
  }) => unknown;
}

interface ToolbarActionGateOptions {
  action: ToolbarActionApi;
  declarativeContent: DeclarativeContentApi;
}

export function createToolbarActionGate(options: ToolbarActionGateOptions) {
  return {
    async start() {
      await options.action.disable();

      options.declarativeContent.onPageChanged.removeRules(undefined, () => {
        options.declarativeContent.onPageChanged.addRules([
          {
            conditions: [
              new options.declarativeContent.PageStateMatcher({
                pageUrl: {
                  hostEquals: 'open.spotify.com',
                  schemes: ['https'],
                },
              }),
            ],
            actions: [new options.declarativeContent.ShowAction()],
          },
        ]);
      });
    },
  };
}

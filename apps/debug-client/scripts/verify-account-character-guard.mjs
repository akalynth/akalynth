import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const files = {
  characterBar: readFileSync(resolve(root, 'src/components/CharacterBar.tsx'), 'utf8'),
  gameClient: readFileSync(resolve(root, 'src/hooks/useGameClient.ts'), 'utf8'),
};

const required = [
  {
    label: 'explicit session-required helper',
    file: 'characterBar',
    literal:
      'Sign in with an account session and CSRF token first; character creation and selection are disabled until the session check succeeds.',
  },
  {
    label: 'create/select handlers use explicit account session guard',
    file: 'characterBar',
    literal: 'function accountSessionGuardMessage(accountSession: AccountSessionStatus): string | null {',
  },
  {
    label: 'missing account session blocks character actions before request',
    file: 'characterBar',
    literal: "Sign in to an account before creating or selecting a character.",
  },
  {
    label: 'missing csrf blocks character actions before request',
    file: 'characterBar',
    literal: 'const guarded = accountSessionGuardMessage(activeAccountSession);',
  },
  {
    label: 'create fields disabled by missing account session or csrf token',
    file: 'characterBar',
    literal: 'const createFieldsDisabled = busy || sessionRequired || !accountSession.csrfReady;',
  },
  {
    label: 'select disabled by missing csrf token',
    file: 'characterBar',
    literal: 'const canSelect = !busy && accountSession.authenticated && accountSession.csrfReady && !!selectedCharacterId;',
  },
  {
    label: 'create submit refreshes account session before POST',
    file: 'characterBar',
    literal: 'const next = await onRefreshAccountSession();',
  },
  {
    label: 'create path uses account character API',
    file: 'gameClient',
    literal: "httpUrl(config.httpBase, '/v1/characters')",
  },
  {
    label: 'select path uses account character API',
    file: 'gameClient',
    literal: "httpUrl(config.httpBase, '/v1/characters/select')",
  },
  {
    label: 'world catalog uses account-character API',
    file: 'gameClient',
    literal: "httpUrl(config.httpBase, '/v1/worlds')",
  },
  {
    label: 'outfit catalog uses account-character API',
    file: 'gameClient',
    literal: "httpUrl(config.httpBase, '/v1/outfits')",
  },
  {
    label: 'world catalog response is validated',
    file: 'gameClient',
    literal: 'worldsBody.worlds.filter(isCharacterCatalogWorld)',
  },
  {
    label: 'outfit catalog response is validated',
    file: 'gameClient',
    literal: 'outfitsBody.outfits.filter(isCharacterCatalogOutfit)',
  },
  {
    label: 'create path requires account session',
    file: 'gameClient',
    literal: 'const account = await requireAccountSession();',
  },
  {
    label: 'select path requires account session',
    file: 'gameClient',
    literal: 'const account = await requireAccountSession({ allowUnverified: true });',
  },
  {
    label: 'CSRF header is sent when present',
    file: 'gameClient',
    literal: "headers['x-csrf-token'] = csrf;",
  },
  {
    label: 'account character requests include account session cookies',
    file: 'gameClient',
    literal: "credentials: 'include',",
  },
  {
    label: 'account session state tracks csrf readiness',
    file: 'gameClient',
    literal: 'csrfReady: ok && !!csrf,',
  },
  {
    label: 'account session requirement blocks missing csrf token',
    file: 'gameClient',
    literal: 'if (!account.csrfReady) {',
  },
  {
    label: 'inline helper names csrf token requirement',
    file: 'characterBar',
    literal:
      'Sign in with an account session and CSRF token first; character creation and selection are disabled until the session check succeeds.',
  },
  {
    label: 'world selector is driven by catalog worlds',
    file: 'characterBar',
    literal: 'catalog.worlds.map((world) => (',
  },
  {
    label: 'outfit selector filters by selected sex',
    file: 'characterBar',
    literal: 'catalog.outfits.filter((entry) => entry.sex === sex)',
  },
  {
    label: 'create path submits world id',
    file: 'characterBar',
    literal: 'world_id: worldId,',
  },
  {
    label: 'create path submits outfit id',
    file: 'characterBar',
    literal: 'outfit_id: outfitId,',
  },
  {
    label: 'create path submits typed account character v2 body',
    file: 'gameClient',
    literal: '} satisfies AccountCharacterCreateRequest),',
  },
  {
    label: 'select path submits selected character id',
    file: 'gameClient',
    literal: 'body: JSON.stringify({ character_id: characterId }),',
  },
  {
    label: 'create/select response validates full play response',
    file: 'gameClient',
    literal: 'if (!isAccountCharacterPlayResponse(body)) {',
  },
  {
    label: 'create disabled until catalog is loaded',
    file: 'characterBar',
    literal: '!!catalog.loaded',
  },
  {
    label: 'catalog loading disables world selector',
    file: 'characterBar',
    literal: 'disabled={createFieldsDisabled || !catalog.loaded || catalog.loading}',
  },
];

const missing = required.filter((entry) => !files[entry.file].includes(entry.literal));

if (missing.length > 0) {
  for (const entry of missing) {
    console.error(`missing ${entry.label}: ${entry.literal}`);
  }
  process.exit(1);
}

const forbidden = [
  'mints a signed token',
  'Guest play remains',
  'guest play remains',
];

const stale = Object.entries(files).flatMap(([file, text]) =>
  forbidden
    .filter((literal) => text.includes(literal))
    .map((literal) => ({ file, literal }))
);

if (stale.length > 0) {
  for (const entry of stale) {
    console.error(`stale account-character wording in ${entry.file}: ${entry.literal}`);
  }
  process.exit(1);
}

console.log('debug-client account character guard ok');

/**
 * Vitest/Vite may resolve `tslib` to `tslib.es6.mjs` under the "module"
 * export condition. @supabase/* packages then `require()` that file and Node
 * throws ERR_REQUIRE_ESM. Force the CJS entry for Node's require resolver.
 */
import Module from 'node:module';
import path from 'node:path';

const tslibCjs = path.resolve(process.cwd(), 'node_modules/tslib/tslib.js');

const moduleWithResolve = Module as typeof Module & {
  _resolveFilename: (
    request: string,
    parent: NodeModule | null,
    isMain: boolean,
    options?: unknown
  ) => string;
};

const originalResolveFilename = moduleWithResolve._resolveFilename;

moduleWithResolve._resolveFilename = function resolveFilename(
  request: string,
  parent: NodeModule | null,
  isMain: boolean,
  options?: unknown
) {
  if (request === 'tslib' || request === 'tslib/tslib.es6.mjs') {
    return tslibCjs;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

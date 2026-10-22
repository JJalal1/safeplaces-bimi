import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const nextLintRequire=createRequire(require.resolve('eslint-config-next'));
const nextPluginRequire=createRequire(nextLintRequire.resolve('@next/eslint-plugin-next'));
const globRequire=createRequire(nextPluginRequire.resolve('fast-glob'));
const micromatchRequire=createRequire(globRequire.resolve('micromatch'));
const braces=micromatchRequire('braces');
assert.deepEqual(braces.expand('assets/{ar,en}/file{1..2}.js'),['assets/ar/file1.js','assets/ar/file2.js','assets/en/file1.js','assets/en/file2.js']);
for(const char of ['{','(']){
 const close=char==='{'?'}':')',pattern=char.repeat(20000)+'a'+close.repeat(20000);
 for(const method of ['compile','expand','stringify'])assert.throws(()=>braces[method](pattern),/safe nesting limit/);
}
let ast={type:'text',value:'a'};
for(let depth=0;depth<1000;depth++)ast={type:'root',nodes:[ast]};
for(const method of ['compile','expand','stringify'])assert.throws(()=>braces[method](ast),/safe nesting limit/,'Already parsed ASTs are bounded too');
const minimatchRequire=createRequire(require.resolve('eslint/package.json'));
const minimatch=minimatchRequire('minimatch');
assert.equal(minimatch('source/ar/file.ts','source/{ar,en}/*.ts'),true);
assert.equal(minimatch('source/fr/file.ts','source/{ar,en}/*.ts'),false);
for(const entry of readdirSync('node_modules/.pnpm').filter(name=>name.startsWith('minimatch@'))){
 const local=createRequire(resolve('node_modules/.pnpm',entry,'node_modules/minimatch/package.json'));
 const module=local('minimatch'),match=typeof module==='function'?module:module.minimatch;
 assert.equal(match('source/ar/file.ts','source/{ar,en}/*.ts'),true,entry+' brace expansion remains compatible');
 assert.equal(match('source/fr/file.ts','source/{ar,en}/*.ts'),false,entry+' rejects other paths');
}
const rscRequire=createRequire(require.resolve('@vitejs/plugin-rsc'));
assert.equal(rscRequire('react-server-dom-webpack/package.json').version,'19.2.8');
console.log('PASS: reviewed RSC patch, common glob patterns and bounded nested string/AST walkers for the locally patched braces advisory');

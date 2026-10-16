const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
const ts=require(repo+'/node_modules/typescript'),React=require(repo+'/node_modules/react'),{renderToStaticMarkup}=require(repo+'/node_modules/react-dom/server');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(repo,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:n=>n==='@/lib/hunt-currency'?load('lib/hunt-currency.ts'):require(require.resolve(n,{paths:[repo]})),Intl});return module.exports;}
const List=load('components/community-bonus-list.tsx').default;
const html=renderToStaticMarkup(React.createElement(List,{currency:'CAD',bonuses:[{id:'pending',slotName:'Wild Zombies',betSize:1,payout:null,multiplier:0,note:'Viewer'},{id:'zero',slotName:'Zero Return',betSize:1,payout:0,multiplier:0},{id:'paid',slotName:'Paid Bonus',betSize:2,payout:100,multiplier:50}]}));
assert(html.includes('Wild Zombies'));assert(html.includes('Called by Viewer'));assert(html.includes('Awaiting opening'));assert(html.includes('CAD'));assert(html.includes('100.00'));assert(html.includes('50.00×'));assert(html.includes('0.00×'));assert(html.includes('3 Slots'));assert(!html.includes('NaN'));
const empty=renderToStaticMarkup(React.createElement(List,{}));assert(empty.includes('No bonuses collected'));assert(empty.includes('0 Slots'));
console.log('PASS community slot names, caller, hunt currency, pending opening, zero/paid payouts, multiplier and empty list display.');

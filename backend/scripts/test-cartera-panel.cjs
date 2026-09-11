const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const react = require('react');
function compile(file, resolve) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}
const helper = compile('backend/src/utils/cartera-clients.ts', require);
const invoice = (id, clientName, clientNit, status, paidAmount, clientId = 'acb') => ({
  id, invoiceNumber: id, clientId, clientName, clientNit, status, paidAmount,
  totalAmount: 100, fecha: '2026-09-01', tipoDocumento: 'cuenta_cobro', factusStatus: null,
});
const fixtures = [
  invoice('pending', 'ACB Fit', '901725973', 'pendiente', 0),
  { ...invoice('partial', 'ACBFIT SAS', '900123456-7', 'parcial', 40), concepto: 'Servicio mensual', items: [{descripcion:'Campanas digitales'}], payments: [{amount:40,paidAt:'2026-09-05',paymentMethod:'Transferencia',reference:'REF-01'}] },
  invoice('paid', 'ACBFIT', '901725973', 'pagada', 0),
  invoice('paid2', 'ACBFIT', 'Ana Elisa', 'pagada', 100),
  invoice('other', 'Otro Cliente', '12345678', 'pendiente', 0, 'other'),
];
const states = [fixtures, false];
let cursor = 0;
let exported;
const component = compile('src/components/finance/CarteraPanel.tsx', (name) => {
  if (name === 'react') return { ...react, useState: (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], (value) => { states[index] = value; }];
  }, useMemo: (fn) => fn(), useEffect: () => {}, useRef: (value) => ({ current: value }) };
  if (name === '@/lib/cartera-document-data') return compile('src/lib/cartera-document-data.ts', require);
  if (name === '@/lib/cartera-clients') return helper;
  if (name === '@/lib/utils') return { cn: (...values) => values.join(' ') };
  if (name === '@/hooks/use-toast') return { useToast: () => ({ toast: (message) => { if (message.variant === 'destructive') throw Error(message.description); } }) };
  if (name === '@/lib/finance-exports') return { exportCarteraPDF: async (data) => { exported = data; } };
  if (name === '@/lib/api') return { apiClient: {} };
  if (name.startsWith('@/components/ui/') || name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
  return require(name);
}).default;
const render = () => { cursor = 0; return component(); };
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  return react.Children.toArray(node.props?.children).map((child) => find(child, predicate)).find(Boolean);
}
const selector = (tree) => find(tree, (node) => node.props?.id === 'cartera-client');
const options = (tree) => react.Children.toArray(selector(tree).props.children).filter((node) => node.type === 'option');
const pdfButton = (tree) => find(tree, (node) => node.type === 'Button' && react.Children.toArray(node.props.children).includes('PDF'));
(async () => {
  let tree = render();
  assert.equal(options(tree).length, 3); // all + ACB + other, no duplicate ACB
  await pdfButton(tree).props.onClick();
  assert.equal(exported.vista, 'general');
  assert.equal(exported.totalCartera, 260);
  assert.equal(exported.clientes.length, 2);
  find(tree, (node) => node.props?.id === 'cartera-search').props.onChange({ target: { value: 'ACBFIT' } });
  tree = render();
  assert.equal(options(tree).length, 2);
  const key = options(tree)[1].props.value;
  selector(tree).props.onChange({ target: { value: key } });
  tree = render();
  assert.equal(selector(tree).props.value, key);
  await pdfButton(tree).props.onClick();
  assert.equal(exported.vista, 'cliente');
  assert.deepEqual(exported.facturas.map((row) => row.invoiceNumber).sort(), ['partial', 'pending']);
  assert.equal(exported.totalSaldo, 160);
  assert.equal(exported.totalPagado, 40);
  const partial = exported.facturas.find((row) => row.invoiceNumber === 'partial');
  assert.match(partial.description, /Servicio mensual/);
  assert.match(partial.description, /Campanas digitales/);
  assert.equal(partial.payments[0].amount,40);
  assert.equal(partial.payments[0].reference,'REF-01');
  selector(tree).props.onChange({ target: { value: '' } });
  await pdfButton(render()).props.onClick();
  assert.equal(exported.vista, 'general');
  assert.equal(exported.totalCartera, 260);
  console.log('PASS: client search, deduplication, selection, reset, general and client PDF payloads, unpaid and partial balances.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

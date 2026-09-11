// No database or SMTP connections: exercise the real report with injected adapters.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__dirname', code)(
    (name) => dependencies[name] || require(name), module, module.exports, __dirname);
  return module.exports;
}
let rows = [];
let sent;
let rejected = [];
const grouping = load('src/utils/cartera-clients.ts');
const service = load('src/services/dailyReports.service.ts', {
  '@prisma/client': { PrismaClient: class { invoice = { findMany: async (query) => {
    assert.equal(query.take, undefined);
    return rows;
  } }; } },
  nodemailer: { createTransport: () => ({ sendMail: async (message) => {
    sent = message;
    return { rejected };
  } }) },
  googleapis: { google: {} },
  './googleSheets.service': {},
  '../utils/cartera-clients': grouping,
});
const invoice = (id, nit, overrides = {}) => ({
  id, clientId: id, clientName: 'Empresa <SAS>', clientNit: nit,
  invoiceNumber: id, totalAmount: 100, paidAmount: 20, status: 'parcial',
  factusStatus: null, fecha: new Date('2026-09-01'), concepto: '<Detalle>', servicio: null,
  ...overrides,
});
(async () => {
  assert.equal(grouping.groupCarteraClients([invoice('legacy', '9018834468'), invoice('canonical', '901883468')]).clients.length, 1);
  const identities = grouping.groupCarteraClients([
    invoice('a', '901725973', { clientId: 'acb', clientName: 'ACB Fit' }),
    invoice('b', '900123456-7', { clientId: 'acb', clientName: 'ACBFIT SAS' }),
    invoice('c', 'Ana Elisa', { clientId: 'acb', clientName: 'ACBFIT' }),
    invoice('d', '901725973', { clientId: 'acb', clientName: 'Gimnasio ACBFIT' }),
    invoice('e', '', { clientId: '', clientName: 'ACBFIT SAS' }),
    invoice('f', '123456789', { clientId: 'other', clientName: 'ACB Fit' }),
    invoice('g', '00000', { clientId: 'zero-a', clientName: 'Cliente Uno' }),
    invoice('h', '000000', { clientId: 'zero-b', clientName: 'Cliente Dos' }),
  ]);
  assert.equal(identities.clients.length, 5); // ambiguous no-ID name stays separate
  assert.equal(identities.invoices[0].clientKey, identities.invoices[1].clientKey);
  assert.equal(identities.invoices[0].clientKey, identities.invoices[2].clientKey);
  assert.notEqual(identities.invoices[0].clientKey, identities.invoices[5].clientKey);
  assert.notEqual(identities.invoices[6].clientKey, identities.invoices[7].clientKey);
  const acb = identities.clients.find((client) => client.nit === '901725973');
  assert.ok(grouping.matchesCarteraClient(acb, 'ACBFIT'));
  assert.ok(grouping.matchesCarteraClient(acb, 'ACB 901.725.973'));
  assert.ok(grouping.matchesCarteraClient(acb, '900123456-7'));
  assert.equal(grouping.matchesCarteraClient(acb, 'no existe'), false);
  assert.equal(grouping.isPendingCarteraInvoice(invoice('partial', '1', {status:'parcial',paidAmount:40})), true);
  assert.equal(grouping.isPendingCarteraInvoice(invoice('pending', '1', {status:'pendiente',paidAmount:0})), true);
  assert.equal(grouping.isPendingCarteraInvoice(invoice('small', '1', {status:'pendiente',totalAmount:0.25,paidAmount:0})), true);
  rows = Array.from({ length: 201 }, (_, i) => invoice(String(i), i % 2 ? '900123456' : '900.123.456-7'));
  rows.push(invoice('paid-stale-account', '800123456', { status: 'pagada', paidAmount: 0, tipoDocumento: 'cuenta_cobro' }));
  rows.push(invoice('paid-stale-electronic', '800123456', { status: 'pagada', paidAmount: 0, tipoDocumento: 'factura_electronica' }));
  assert.equal(grouping.isPendingCarteraInvoice(invoice('paid-helper', '800123456', {status:'pagada',paidAmount:0})), false);
  rows.push(invoice('paid', '800123456', { paidAmount: 100 }));
  rows.push(invoice('void', '800123456', { factusStatus: 'anulada' }));
  const result = await service.enviarCarteraCorregida();
  assert.equal(result.success, true);
  assert.equal(sent.to, 'Dairotras@gmail.com');
  assert.equal(sent.cc, 'jhonpm07@gmail.com');
  assert.match(result.resumen, /201 facturas \| 1 clientes/);
  assert.match(result.resumen, /16\.080/);
  assert.match(sent.html, /Empresa &lt;SAS&gt;/);
  assert.match(sent.html, /&lt;Detalle&gt;/);
  rejected = ['jhonpm07@gmail.com'];
  await assert.rejects(service.enviarCarteraCorregida());
  rows = [];
  assert.match((await service.reporteCartera()).subject, /Sin pendientes/);
  console.log('OK: recipients, grouping, 201 invoices, balances, exclusions, HTML and partial SMTP failure.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

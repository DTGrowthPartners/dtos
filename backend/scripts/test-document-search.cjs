const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/lib/document-search.ts'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const loaded = {exports:{}};
new Function('exports', compiled)(loaded.exports);
const {filterDocuments} = loaded.exports;
const rows = [
 {id:'1',clientName:'Julián Castrillón',clientNit:'901.725.973-4',invoiceNumber:'202607290705',tipoDocumento:'cuenta_cobro',status:'pagada'},
 {id:'2',clientName:'SAN AUTOS',clientNit:'806014651',invoiceNumber:'202609110001',factusNumber:'FE-12345',tipoDocumento:'factura_electronica',status:'parcial'}
];
assert.equal(filterDocuments(rows,'julian castrillon','','')[0].id,'1');
assert.equal(filterDocuments(rows,'901725973','','')[0].id,'1');
assert.equal(filterDocuments(rows,'','290705','')[0].id,'1');
assert.equal(filterDocuments(rows,'autos','fe123','factura_electronica')[0].id,'2');
assert.equal(filterDocuments(rows,'julian','fe123','').length,0);
assert.equal(filterDocuments(rows,'','','').length,2);
assert.equal(filterDocuments(rows,'','','cuenta_cobro').length,1);
assert.equal(filterDocuments(rows,'inexistente','','').length,0);
console.log('PASS client/name/NIT, partial/internal/electronic numbers, combined filters, all states and empty results');

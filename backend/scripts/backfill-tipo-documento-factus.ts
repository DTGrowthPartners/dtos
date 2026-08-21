// Reclasifica facturas emitidas por Factus antes del split Cuentas de Cobro /
// Facturas Electrónicas: quedaron con tipoDocumento='cuenta_cobro' pero ya
// tienen factusNumber (fueron enviadas a DIAN), así que hoy aparecerían en
// el módulo equivocado.
//
// Uso:
//   npx ts-node scripts/backfill-tipo-documento-factus.ts          (dry-run, solo lista)
//   npx ts-node scripts/backfill-tipo-documento-factus.ts --apply  (aplica el cambio)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');

  const legacy = await prisma.invoice.findMany({
    where: { tipoDocumento: 'cuenta_cobro', factusNumber: { not: null } },
    select: { id: true, invoiceNumber: true, clientName: true, factusNumber: true, fecha: true },
    orderBy: { fecha: 'asc' },
  });

  if (legacy.length === 0) {
    console.log('No hay facturas para reclasificar. Nada que hacer.');
    return;
  }

  console.log(`${legacy.length} factura(s) con factusNumber pero tipoDocumento='cuenta_cobro':`);
  for (const inv of legacy) {
    console.log(`  - ${inv.id} | ${inv.clientName} | invoiceNumber=${inv.invoiceNumber} | factusNumber=${inv.factusNumber} | fecha=${inv.fecha.toISOString().slice(0, 10)}`);
  }

  if (!apply) {
    console.log('\nDry-run: no se modificó nada. Vuelve a correr con --apply para reclasificarlas.');
    return;
  }

  const result = await prisma.invoice.updateMany({
    where: { tipoDocumento: 'cuenta_cobro', factusNumber: { not: null } },
    data: { tipoDocumento: 'factura_electronica' },
  });
  console.log(`\n${result.count} factura(s) reclasificada(s) a tipoDocumento='factura_electronica'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

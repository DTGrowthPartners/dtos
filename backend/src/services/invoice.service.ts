import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { CreateInvoiceDto } from '../dtos/invoice.dto';

// Normaliza valores de texto: convierte undefined/null y los strings basura
// "undefined"/"null" (que algunos clientes envían literalmente) en cadena vacía.
// Así el PDF nunca imprime "undefined" y spawn nunca recibe un arg no-string.
export const cleanText = (v: any): string => {
  const s = (v == null ? '' : String(v)).trim();
  const low = s.toLowerCase();
  return low === 'undefined' || low === 'null' ? '' : s;
};
const clean = cleanText;

class InvoiceService {
  public async generateInvoicePdf(invoiceData: CreateInvoiceDto): Promise<{ generatedPath: string; invoiceNumber: string }> {
    return new Promise((resolve, reject) => {
      const {
        nombre_cliente,
        identificacion,
        servicios,
        observaciones,
        concepto,
        fecha,
        servicio_proyecto,
      } = invoiceData;

      // Convert services array to a JSON string
      const servicesJson = JSON.stringify(servicios);

      // Path to the Python script
      const scriptPath = path.join(__dirname, 'generador.py');

      // Arguments for the Python script (saneados: nunca undefined ni "undefined")
      const scriptArgs = [
        clean(nombre_cliente),
        clean(identificacion),
        servicesJson,
        clean(observaciones),
        clean(concepto),
        clean(fecha),
        clean(servicio_proyecto),
      ];

      // Spawn the Python process
      const pythonProcess = spawn('python3', [scriptPath, ...scriptArgs]);

      let pdfPath = '';
      let errorOutput = '';

      // Listen for data on stdout
      pythonProcess.stdout.on('data', (data) => {
        pdfPath += data.toString().trim();
      });

      // Listen for data on stderr
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`Python Script Error: ${data}`);
      });

      // Handle process exit
      pythonProcess.on('close', (code) => {
        if (code === 0 && pdfPath) {
          console.log(`PDF generated successfully at: ${pdfPath}`);
          // Extract invoice number from filename
          const filename = path.basename(pdfPath);
          const invoiceNumber = filename.match(/cuenta_cobro_.*?_(\d+)\.pdf/)?.[1] || Date.now().toString();
          resolve({ generatedPath: pdfPath, invoiceNumber });
        } else {
          console.error(`Python script exited with code ${code}`);
          reject(new Error(`Failed to generate PDF. Error: ${errorOutput}`));
        }
      });

      // Handle spawn errors
      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process.', err);
        reject(new Error('Failed to start PDF generation process.'));
      });
    });
  }
}

export const invoiceService = new InvoiceService();

// --- Link público firmado para descargar el PDF (sin login, sin exponer API keys) ---
const linkSecret = () => process.env.INVOICE_LINK_SECRET || process.env.JWT_SECRET || 'dtos-invoice-link';

/** Firma HMAC del id de la factura (para validar links públicos de descarga). */
export const signInvoiceId = (id: string): string =>
  crypto.createHmac('sha256', linkSecret()).update(id).digest('hex');

/** URL pública firmada para descargar el PDF de una factura. */
export const getPublicInvoiceUrl = (id: string): string => {
  const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://os.dtgrowthpartners.com').replace(/\/$/, '');
  return `${base}/api/invoices/${id}/pdf?sig=${signInvoiceId(id)}`;
};

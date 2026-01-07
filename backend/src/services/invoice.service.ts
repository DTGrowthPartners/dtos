import { spawn } from 'child_process';
import path from 'path';
import { CreateInvoiceDto } from '../dtos/invoice.dto';

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
      
      // Arguments for the Python script
      const scriptArgs = [
        nombre_cliente,
        identificacion,
        servicesJson,
        observaciones,
        concepto,
        fecha,
        servicio_proyecto || '',
      ];

      // Spawn the Python process
      const pythonProcess = spawn('python', [scriptPath, ...scriptArgs]);

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

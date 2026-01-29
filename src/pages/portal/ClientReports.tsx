import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileSpreadsheet, Eye, Download } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ExcelFile {
  id: string;
  name: string;
  fileName: string;
  sheetNames: string[];
  description: string | null;
  createdAt: string;
  data?: Record<string, any[][]>;
}

export default function ClientReports() {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<ExcelFile | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<ExcelFile[]>('/api/client-portal/portal/excel');
      setFiles(response);
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewFile = async (file: ExcelFile) => {
    try {
      setLoadingFile(true);
      const response = await apiClient.get<ExcelFile>(`/api/client-portal/portal/excel/${file.id}`);
      setSelectedFile(response);
      setSelectedSheet(response.sheetNames[0] || '');
      setViewerOpen(true);
    } catch (err) {
      console.error('Error loading file:', err);
    } finally {
      setLoadingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Archivos y reportes compartidos</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">Archivos y reportes compartidos por tu equipo</p>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No hay reportes disponibles</p>
              <p className="text-sm">Los reportes aparecerán aquí cuando tu equipo los comparta contigo</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <Card key={file.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{file.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{file.fileName}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {file.description && (
                  <p className="text-sm text-muted-foreground mb-3">{file.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(file.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => viewFile(file)}
                    disabled={loadingFile}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Excel Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                {selectedFile?.name}
              </DialogTitle>
              {selectedFile && selectedFile.sheetNames.length > 1 && (
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFile.sheetNames.map((sheet) => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] border rounded-lg">
            {selectedFile?.data && selectedSheet && (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {(selectedFile.data[selectedSheet] || []).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={rowIndex === 0 ? 'bg-muted font-medium sticky top-0' : 'hover:bg-muted/50'}
                    >
                      {row.map((cell: any, cellIndex: number) => (
                        <td
                          key={cellIndex}
                          className="border border-border px-3 py-2 whitespace-nowrap"
                        >
                          {cell !== null && cell !== undefined ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

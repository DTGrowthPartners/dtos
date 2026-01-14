import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, FileText, Plus, Edit, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NominaRecord {
  id: string;
  fecha: string;
  terceroId: string;
  terceroNombre?: string;
  concepto: 'salario' | 'prima' | 'bonificacion' | 'vacaciones' | 'liquidacion' | 'otro';
  salarioBase: number;
  deducciones: number;
  bonificaciones: number;
  totalPagado: number;
  notas?: string;
}

interface Tercero {
  id: string;
  nombre: string;
  tipo: string;
}

// Datos de prueba - Empleados
const mockEmpleados: Tercero[] = [
  { id: '3', nombre: 'Carlos Martínez', tipo: 'empleado' },
  { id: '4', nombre: 'María García', tipo: 'empleado' },
  { id: '5', nombre: 'Juan Rodríguez', tipo: 'empleado' },
];

// Datos de prueba - Registros de nómina
const mockNominaRecords: NominaRecord[] = [
  {
    id: '1',
    fecha: '2024-12-30',
    terceroId: '3',
    terceroNombre: 'Carlos Martínez',
    concepto: 'salario',
    salarioBase: 5500000,
    deducciones: 440000,
    bonificaciones: 0,
    totalPagado: 5060000,
    notas: 'Pago salario diciembre 2024',
  },
  {
    id: '2',
    fecha: '2024-12-30',
    terceroId: '4',
    terceroNombre: 'María García',
    concepto: 'salario',
    salarioBase: 4500000,
    deducciones: 360000,
    bonificaciones: 200000,
    totalPagado: 4340000,
    notas: 'Pago salario diciembre + bono',
  },
  {
    id: '3',
    fecha: '2024-12-30',
    terceroId: '5',
    terceroNombre: 'Juan Rodríguez',
    concepto: 'salario',
    salarioBase: 6000000,
    deducciones: 480000,
    bonificaciones: 0,
    totalPagado: 5520000,
    notas: 'Pago salario diciembre 2024',
  },
  {
    id: '4',
    fecha: '2024-12-15',
    terceroId: '3',
    terceroNombre: 'Carlos Martínez',
    concepto: 'prima',
    salarioBase: 5500000,
    deducciones: 0,
    bonificaciones: 0,
    totalPagado: 2750000,
    notas: 'Prima de navidad 2024',
  },
  {
    id: '5',
    fecha: '2024-12-15',
    terceroId: '4',
    terceroNombre: 'María García',
    concepto: 'prima',
    salarioBase: 4500000,
    deducciones: 0,
    bonificaciones: 0,
    totalPagado: 2250000,
    notas: 'Prima de navidad 2024',
  },
  {
    id: '6',
    fecha: '2024-11-30',
    terceroId: '3',
    terceroNombre: 'Carlos Martínez',
    concepto: 'salario',
    salarioBase: 5500000,
    deducciones: 440000,
    bonificaciones: 500000,
    totalPagado: 5560000,
    notas: 'Pago salario noviembre + bono proyecto',
  },
];

export function NominaModal({ onClose }: { onClose: () => void }) {
  const [nominaRecords, setNominaRecords] = useState<NominaRecord[]>(mockNominaRecords);
  const [terceros] = useState<Tercero[]>(mockEmpleados);
  const [isLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NominaRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    fecha: string;
    terceroId: string;
    concepto: 'salario' | 'prima' | 'bonificacion' | 'vacaciones' | 'liquidacion' | 'otro';
    salarioBase: string;
    deducciones: string;
    bonificaciones: string;
    totalPagado: string;
    notas: string;
  }>({
    fecha: new Date().toISOString().split('T')[0],
    terceroId: '',
    concepto: 'salario',
    salarioBase: '',
    deducciones: '',
    bonificaciones: '',
    totalPagado: '',
    notas: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: NominaRecord = {
      id: editingRecord?.id || Date.now().toString(),
      fecha: formData.fecha,
      terceroId: formData.terceroId,
      terceroNombre: terceros.find(t => t.id === formData.terceroId)?.nombre,
      concepto: formData.concepto,
      salarioBase: parseFloat(formData.salarioBase) || 0,
      deducciones: parseFloat(formData.deducciones) || 0,
      bonificaciones: parseFloat(formData.bonificaciones) || 0,
      totalPagado: parseFloat(formData.totalPagado) || 0,
      notas: formData.notas,
    };

    if (editingRecord) {
      setNominaRecords(prev => prev.map(r => r.id === editingRecord.id ? payload : r));
      toast({
        title: 'Éxito',
        description: 'Registro de nómina actualizado correctamente',
      });
    } else {
      setNominaRecords(prev => [payload, ...prev]);
      toast({
        title: 'Éxito',
        description: 'Registro de nómina agregado correctamente',
      });
    }
    setShowForm(false);
    setEditingRecord(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      terceroId: '',
      concepto: 'salario',
      salarioBase: '',
      deducciones: '',
      bonificaciones: '',
      totalPagado: '',
      notas: '',
    });
  };

  const filteredRecords = nominaRecords.filter(record => {
    const terceroNombre = terceros.find(t => t.id === record.terceroId)?.nombre || '';
    return searchTerm === '' || 
      terceroNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.fecha.includes(searchTerm);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h3 className="font-semibold text-xl text-foreground">Gestión de Nómina</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {!showForm ? (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar registros de nómina..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>

              <Button onClick={() => {
                setShowForm(true);
                setEditingRecord(null);
                resetForm();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Registro
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Fecha</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Empleado</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Concepto</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Salario Base</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Total Pagado</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <tr key={record.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-2 text-foreground">{record.fecha}</td>
                          <td className="py-3 px-2 text-foreground">
                            {terceros.find(t => t.id === record.terceroId)?.nombre || record.terceroId}
                          </td>
                          <td className="py-3 px-2 text-foreground">{record.concepto}</td>
                          <td className="py-3 px-2 text-muted-foreground">
                            ${record.salarioBase.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-foreground font-medium">
                            ${record.totalPagado.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingRecord(record);
                                  setFormData({
                                    fecha: record.fecha,
                                    terceroId: record.terceroId,
                                    concepto: record.concepto,
                                    salarioBase: record.salarioBase.toString(),
                                    deducciones: record.deducciones.toString(),
                                    bonificaciones: record.bonificaciones.toString(),
                                    totalPagado: record.totalPagado.toString(),
                                    notas: record.notas || '',
                                  });
                                  setShowForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No se encontraron registros de nómina
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">
                {editingRecord ? 'Editar Registro de Nómina' : 'Agregar Registro de Nómina'}
              </h4>
              <Button variant="ghost" onClick={() => {
                setShowForm(false);
                setEditingRecord(null);
                resetForm();
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Fecha</label>
                  <Input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Empleado</label>
                  <Select
                    value={formData.terceroId}
                    onValueChange={(value) => setFormData({...formData, terceroId: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      {terceros.map((tercero) => (
                        <SelectItem key={tercero.id} value={tercero.id}>
                          {tercero.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Concepto</label>
                  <Select
                    value={formData.concepto}
                    onValueChange={(value: 'salario' | 'prima' | 'bonificacion' | 'vacaciones' | 'liquidacion' | 'otro') => setFormData({...formData, concepto: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar concepto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salario">Salario</SelectItem>
                      <SelectItem value="prima">Prima</SelectItem>
                      <SelectItem value="bonificacion">Bonificación</SelectItem>
                      <SelectItem value="vacaciones">Vacaciones</SelectItem>
                      <SelectItem value="liquidacion">Liquidación</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Salario Base</label>
                  <Input
                    type="number"
                    value={formData.salarioBase}
                    onChange={(e) => setFormData({...formData, salarioBase: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Deducciones</label>
                  <Input
                    type="number"
                    value={formData.deducciones}
                    onChange={(e) => setFormData({...formData, deducciones: e.target.value})}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Bonificaciones</label>
                  <Input
                    type="number"
                    value={formData.bonificaciones}
                    onChange={(e) => setFormData({...formData, bonificaciones: e.target.value})}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Total Pagado</label>
                  <Input
                    type="number"
                    value={formData.totalPagado}
                    onChange={(e) => setFormData({...formData, totalPagado: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Notas</label>
                  <Input
                    value={formData.notas}
                    onChange={(e) => setFormData({...formData, notas: e.target.value})}
                    placeholder="Notas adicionales"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingRecord(null);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingRecord ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Actualizar Registro
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Registro
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
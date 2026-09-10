// Pruebas locales: reemplazan Firestore y notificaciones; nunca conectan a producción.
// Ejecutar desde la raíz: node scripts/smoke/tareas-ia-local.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const raiz = path.resolve(__dirname, '../..');

function cargar(archivo, modulos = {}, globales = {}) {
  const fuente = fs.readFileSync(path.join(raiz, archivo), 'utf8');
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports,
    require: (nombre) => { if (!(nombre in modulos)) throw new Error(`Importación no simulada: ${nombre}`); return modulos[nombre]; },
    console, Date, Event, ...globales,
  }, { filename: archivo });
  return modulo.exports;
}

const tipos = cargar('src/types/taskTypes.ts');
const fechas = cargar('src/lib/tareasIA.ts', { '@/types/taskTypes': tipos });
const tareasIniciales = () => ({
  propia: { id: 'propia', title: 'Revisar propuesta', description: '', assignee: 'Stiven', coAssignee: 'Jhonathan', creator: 'Dairo', status: 'TODO', priority: 'HIGH', projectId: '', createdAt: 1 },
  ajena: { id: 'ajena', title: 'Tarea privada', assignee: 'Dairo', creator: 'Dairo', status: 'TODO', priority: 'LOW', projectId: '', createdAt: 1 },
});

function preparar(datos = tareasIniciales(), fallar = false) {
  const almacen = structuredClone(datos);
  const archivo = [];
  const avisos = [];
  const mensajes = [];
  let estado = 0;
  let escrituras = 0;
  const firestore = {
    collection: (_db, nombre) => ({ coleccion: nombre }),
    doc: (base, coleccion, id) => typeof coleccion === 'string' ? { coleccion, id } : { coleccion: base.coleccion, id: 'archivo' },
    deleteField: () => '__BORRAR__',
    onSnapshot: () => () => {},
    runTransaction: async (_db, funcion) => {
      const pendientes = [];
      const resultado = await funcion({
        get: async (ref) => ({ exists: () => !!almacen[ref.id], data: () => almacen[ref.id] }),
        set: (ref, valor) => pendientes.push({ ref, valor, nuevo: true }),
        update: (ref, valor) => pendientes.push({ ref, valor }),
      });
      if (fallar) throw new Error('Sin conexión');
      for (const cambio of pendientes) {
        escrituras++;
        if (cambio.nuevo) archivo.push(cambio.valor);
        else for (const [clave, valor] of Object.entries(cambio.valor)) {
          if (valor === '__BORRAR__') delete almacen[cambio.ref.id][clave];
          else almacen[cambio.ref.id][clave] = valor;
        }
      }
      return resultado;
    },
  };
  const { useTareasIA } = cargar('src/hooks/useTareasIA.ts', {
    react: { useEffect: () => {}, useState: (valor) => [estado++ === 2 ? false : valor, () => {}], useRef: (valor) => ({ current: valor }) },
    'firebase/firestore': firestore,
    '@/lib/firebase': { db: {} },
    '@/lib/auth': { useAuthStore: () => ({ user: { firstName: 'Stiven', email: 'stiven@example.test', role: 'user' } }) },
    '@/hooks/useTeamMembers': { useTeamMembers: () => ['Stiven', 'Dairo', 'Jhonathan'].map((name) => ({ name })) },
    '@/hooks/use-toast': { useToast: () => ({ toast: (valor) => mensajes.push(valor) }) },
    '@/lib/firestoreTaskService': {
      createTask: async (valor) => { almacen.nueva = valor; return 'nueva'; },
      loadProjects: async () => [],
      sendTaskNotification: async (valor) => avisos.push(valor),
      sendHighPriorityTaskToWhatsApp: async (valor) => avisos.push(valor),
    },
    '@/lib/tareasIA': fechas,
    '@/types/taskTypes': tipos,
  }, { window: { dispatchEvent: () => {} } });
  return { hook: useTareasIA(), almacen, archivo, avisos, mensajes, escrituras: () => escrituras };
}

(async () => {
  assert.equal(fechas.fechaColombia(Date.parse('2026-09-11T02:00:00Z')), '2026-09-10');
  assert.equal(fechas.fechaDeFormulario('2026-09-10', '00:00'), Date.parse('2026-09-10T05:00:00Z'));
  assert.equal(fechas.fechaDeFormulario('2026-02-30'), undefined);
  assert.equal(fechas.fechaDeFormulario(''), undefined);
  assert.equal(fechas.fechaColombia(fechas.fechaDeFormulario('2028-02-29', '23:59')), '2028-02-29');
  const muestra = tareasIniciales().propia;
  const vencida = { ...muestra, priority: 'LOW', dueDate: Date.now() - 86400_000 };
  const futura = { ...muestra, priority: 'HIGH', dueDate: Date.now() + 86400_000 };
  assert.ok(fechas.ordenarPorUrgencia(vencida, futura) < 0);

  let prueba = preparar();
  assert.equal(await prueba.hook.asignar('propia', 'Jhonathan'), true);
  assert.equal(prueba.almacen.propia.assignee, 'Jhonathan');
  assert.equal(prueba.almacen.propia.coAssignee, null);
  assert.equal(prueba.avisos.length, 2);

  prueba = preparar();
  await prueba.hook.asignar('propia', 'Dairo');
  assert.equal(prueba.almacen.propia.coAssignee, 'Jhonathan');
  await prueba.hook.asignar('propia', 'Dairo');
  assert.equal(prueba.escrituras(), 1);
  assert.equal(prueba.avisos.length, 2);

  prueba = preparar();
  assert.equal(await prueba.hook.asignar('ajena', 'Stiven'), false);
  assert.equal(await prueba.hook.cambiarEstado('ajena', 'DONE'), false);
  assert.equal(await prueba.hook.asignar('propia', 'Desconocido'), false);
  assert.equal(prueba.escrituras(), 0);
  assert.equal(prueba.avisos.length, 0);

  prueba = preparar();
  await prueba.hook.cambiarEstado('propia', 'DONE');
  await prueba.hook.cambiarEstado('propia', 'DONE');
  assert.equal(prueba.archivo.length, 1);
  assert.equal(prueba.almacen.propia.status, 'DONE');
  assert.ok(prueba.almacen.propia.completedAt);
  await prueba.hook.cambiarEstado('propia', 'TODO');
  assert.equal(prueba.almacen.propia.completedAt, undefined);

  const datos = tareasIniciales();
  datos.propia.recurrence = { enabled: true, frequency: 'weekly' };
  datos.propia.dueDate = Date.now() + 86400_000;
  prueba = preparar(datos);
  await prueba.hook.cambiarEstado('propia', 'DONE');
  assert.equal(prueba.archivo.length, 1);
  assert.equal(prueba.almacen.propia.status, 'TODO');
  assert.equal(prueba.almacen.propia.dueDate, datos.propia.dueDate + 7 * 86400_000);

  datos.propia.deletedAt = Date.now();
  prueba = preparar(datos);
  assert.equal(await prueba.hook.cambiarEstado('propia', 'DONE'), false);
  assert.equal(prueba.escrituras(), 0);

  prueba = preparar(tareasIniciales(), true);
  assert.equal(await prueba.hook.cambiarEstado('propia', 'DONE'), false);
  assert.equal(prueba.archivo.length, 0);
  assert.equal(prueba.almacen.propia.status, 'TODO');
  assert.equal(prueba.avisos.length, 0);

  console.log('Tareas IA: fechas, prioridades, delegación, permisos, historial, recurrencia y fallos verificados sin red.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

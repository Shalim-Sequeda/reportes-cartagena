// @ts-check
import { iniciar } from './src/aplicacion.js';

try {
  const app = await iniciar();
  console.log(`Servidor iniciado en el puerto ${app.puerto}`);
} catch (error) {
  console.error('Error al iniciar el servidor:', error);
  process.exit(1);
}

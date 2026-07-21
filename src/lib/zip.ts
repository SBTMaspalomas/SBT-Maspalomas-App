// Lector de ZIP sin dependencias externas.
//
// Se usa en el navegador (importación masiva de fotos por el administrador). Lee
// el "central directory" del ZIP para localizar cada entrada y descomprime los
// métodos habituales: 0 (stored, sin compresión) y 8 (deflate) mediante la API
// nativa DecompressionStream('deflate-raw'). No cubre ZIP64 ni métodos exóticos,
// suficiente para un ZIP de fotos generado por el sistema operativo.

export interface ZipEntry {
  /** Nombre completo dentro del ZIP (puede incluir carpetas). */
  name: string;
  /** Extrae el contenido de la entrada como bytes. */
  bytes: () => Promise<Uint8Array>;
}

const SIG_EOCD = 0x06054b50; // End Of Central Directory
const SIG_CDH = 0x02014b50; // Central Directory Header

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // DecompressionStream está disponible en navegadores modernos y en el runtime
  // del navegador donde se ejecuta este flujo (subida de ZIP por el admin).
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Analiza un ArrayBuffer de un ZIP y devuelve sus entradas (solo ficheros, no
 * carpetas). Lanza un error si no parece un ZIP válido.
 */
export function readZip(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  const len = buffer.byteLength;

  // Buscar el EOCD desde el final (puede haber comentario final de hasta 65535 B).
  let eocd = -1;
  const minEocd = 22;
  const start = Math.max(0, len - (minEocd + 0xffff));
  for (let i = len - minEocd; i >= start; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un ZIP válido");

  const totalEntries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    if (p + 46 > len || view.getUint32(p, true) !== SIG_CDH) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder("utf-8").decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    // Ignorar carpetas.
    if (name.endsWith("/")) continue;

    entries.push({
      name,
      bytes: async () => {
        // Cabecera local: los tamaños de nombre/extra pueden diferir del central.
        const lhNameLen = view.getUint16(localOffset + 26, true);
        const lhExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
        const raw = u8.subarray(dataStart, dataStart + compressedSize);
        if (method === 0) return new Uint8Array(raw); // stored
        if (method === 8) return inflateRaw(raw); // deflate
        throw new Error(`Método de compresión no soportado (${method}) en ${name}`);
      },
    });
  }

  return entries;
}

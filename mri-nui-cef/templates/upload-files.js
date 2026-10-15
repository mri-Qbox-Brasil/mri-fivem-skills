// Server script: Lua has no directory listing. upload-server.lua validates kind, name and permission before calling.
const fs = require('fs');
const path = require('path');

const root = GetResourcePath(GetCurrentResourceName());

// Lua has no fast base64 decoder; an ArrayBuffer reaches Lua as a byte string (a Buffer arrives as a table).
exports('decodeBase64', (data) => {
  const buf = Buffer.from(String(data), 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
});

exports('listUploadFolder', (folder) => {
  const dir = path.join(root, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const stat = fs.statSync(path.join(dir, entry.name));
      return { name: entry.name, size: stat.size, modified: Math.floor(stat.mtimeMs / 1000) };
    });
});

exports('deleteUploadFile', (folder, name) => {
  try {
    fs.unlinkSync(path.join(root, folder, name));
    return true;
  } catch {
    return false;
  }
});

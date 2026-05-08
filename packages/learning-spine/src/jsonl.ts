import fs from 'node:fs';

export function readJsonlFile<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

export function writeJsonlFile(filePath: string, rows: unknown[]): void {
  const body = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, body.length > 0 ? `${body}\n` : '', 'utf8');
}

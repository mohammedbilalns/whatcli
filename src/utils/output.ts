import process from 'node:process';

export function printTable(headers: string[], rows: string[][]) {
  if (process.stdout.isTTY) {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)));
    const headerStr = headers.map((h, i) => h.padEnd(widths[i])).join('   ');
    console.log(headerStr);
    console.log('─'.repeat(headerStr.length));
    for (const row of rows) {
      console.log(row.map((val, i) => String(val ?? '').padEnd(widths[i])).join('   '));
    }
  } else {
    for (const row of rows) {
      console.log(row.join('\t'));
    }
  }
}

export function printInfo(msg: string) {
  if (process.stdout.isTTY) {
    console.log(msg);
  } else {
    console.error(msg);
  }
}

export function printError(msg: string) {
  console.error(msg);
}

export function printData(msg: string) {
  console.log(msg);
}

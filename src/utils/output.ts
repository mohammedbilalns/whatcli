import process from 'node:process';
import pc from 'picocolors';

export function printTable(headers: string[], rows: string[][]) {
  if (process.stdout.isTTY) {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)));
    const headerStr = headers.map((h, i) => h.padEnd(widths[i])).join('   ');
    console.log(pc.bold(pc.gray(headerStr)));
    console.log(pc.dim('─'.repeat(headerStr.length)));
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
    console.log(pc.cyan(msg));
  } else {
    console.error(msg);
  }
}

export function printSuccess(msg: string) {
  if (process.stdout.isTTY) {
    console.log(pc.green(`✔ ${msg}`));
  } else {
    console.log(msg); // POSIX compliant success to stdout if possible, or stderr? Usually just stdout
  }
}

export function printError(msg: string) {
  if (process.stdout.isTTY) {
    console.error(pc.red(`✖ ${msg}`));
  } else {
    console.error(msg);
  }
}

export function printData(msg: string) {
  console.log(msg);
}

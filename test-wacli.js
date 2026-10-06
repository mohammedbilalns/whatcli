import { spawn } from 'child_process';
const child = spawn('pnpm', ['tsx', 'src/cli/main.ts', 'login']);
child.stdout.on('data', (d) => process.stdout.write(d));
child.stderr.on('data', (d) => process.stderr.write(d));
setTimeout(() => {
  console.log('\nSending SIGINT 1');
  child.kill('SIGINT');
}, 3000);
setTimeout(() => {
  console.log('\nSending SIGINT 2');
  child.kill('SIGINT');
}, 5000);

import { spawn } from 'child_process';
import { config } from 'dotenv';

const command = process.argv[2] as 'publish' | 'package';
if (command === 'publish') {
  config(); // get VSCE_PAT from .env
  if (!process.env.VSCE_PAT) {
    throw new Error('VSCE_PAT is not set');
  }
}

const subProcess = spawn('vsce', [command], {
  stdio: 'inherit',
});

subProcess.on('close', code => {
  if (code !== 0) {
    console.error(`vsce process exited with code ${code}`);
  } else {
    console.log('vsce process exited normally.');
  }
});

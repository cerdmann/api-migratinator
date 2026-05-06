import { execFile } from 'child_process';

export function checkPostmanCli(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('postman', ['--version'], err => {
      if (err) {
        reject(new Error('Postman CLI not found. Install it with: npm install -g postman'));
      } else {
        resolve();
      }
    });
  });
}

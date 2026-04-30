#!/usr/bin/env node
import { Command } from 'commander';
import { discoverCommand } from './commands/discover.js';
import { migrateCommand } from './commands/migrate.js';
import { statusCommand } from './commands/status.js';

process.on('unhandledRejection', (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}`);
  process.exit(1);
});

const program = new Command();

program
  .name('moat')
  .description('M.O.A.T. — Migrate Old APIs Today')
  .version('0.1.0')
  .configureOutput({
    outputError: (str, write) => write(`\nError: ${str}`),
  });

program.addCommand(discoverCommand);
program.addCommand(migrateCommand);
program.addCommand(statusCommand);

program.parse();

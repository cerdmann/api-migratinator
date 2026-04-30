import { Command } from 'commander';
import { getStatus } from '../../migration/status.js';

export const statusCommand = new Command('status')
  .description('Show the status of an in-progress or completed migration run')
  .option('--checkpoint <path>', 'Path to checkpoint file', '.moat-checkpoint.json')
  .action(async (options) => {
    let status;
    try {
      status = await getStatus(options.checkpoint);
    } catch {
      console.error(`No checkpoint found at ${options.checkpoint}. Run \`moat migrate\` first.`);
      process.exit(1);
    }

    console.log(`\nMigration status: ${status.isComplete ? 'COMPLETE' : 'IN PROGRESS'}`);
    console.log(`  Progress:  ${status.percentComplete}% (${status.completed + status.failed}/${status.total})`);
    console.log(`  Completed: ${status.completed}`);
    console.log(`  Failed:    ${status.failed}`);
    console.log(`  Pending:   ${status.pending}`);

    if (status.failures.length > 0) {
      console.log('\nFailed APIs:');
      status.failures.forEach(f => console.log(`  - ${f.id}: ${f.error}`));
    }
  });

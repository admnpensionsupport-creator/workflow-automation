/**
 * MANUAL TRIGGER: Run the workflow once right now.
 * Use this for testing without waiting for cron.
 *
 * Run: node src/run-now.js
 */

import { runWorkflow } from './workflow.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 Manual trigger — running workflow now...\n');

runWorkflow()
  .then(({ success, reports, errors }) => {
    if (success) {
      console.log('\n🎉 All done. No errors.');
    } else {
      console.log('\n⚠️  Completed with errors:');
      errors.forEach((e) => console.log(`   ❌ ${e.label}: ${e.error}`));
    }
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

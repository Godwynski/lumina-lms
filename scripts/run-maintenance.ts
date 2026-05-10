import 'dotenv/config';
import { runMaintenanceTasks } from '../lib/notifications';
import { logger } from '../lib/logger';

async function main() {
  console.log('🚀 Starting Library Maintenance Tasks...');
  console.log('------------------------------------------');

  try {
    const results = await runMaintenanceTasks();
    
    console.log('✅ Maintenance Completed Successfully:');
    console.log(`   - Reminders Sent: ${results.remindersSent}`);
    console.log(`   - Overdue Items Tagged: ${results.overdueTagged}`);
    console.log(`   - Reservations Expired: ${results.reservationsExpired}`);
    
    if (results.errors.length > 0) {
      console.warn('\n⚠️  Warnings/Errors encountered:');
      results.errors.forEach(err => console.error(`   - ${err}`));
    }
  } catch (error) {
    console.error('❌ Critical Maintenance Failure:');
    console.error(error);
    process.exit(1);
  }
}

main();

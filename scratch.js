const { MailtrapClient } = require('mailtrap');
const client = new MailtrapClient({ token: '8a160d6bb53b88db7173fa1300c62d23' });
client.send({
  from: { email: 'mailtrap@demomailtrap.com', name: 'Lumina' },
  to: [{ email: 'test@example.com' }],
  subject: 'Test',
  text: 'Test',
}).then(console.log).catch(console.error);

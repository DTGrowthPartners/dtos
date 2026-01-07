const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const newPassword = 'admin123'; // Change this to your desired password

bcrypt.hash(newPassword, SALT_ROUNDS).then(hash => {
  console.log('Update command:');
  console.log(`UPDATE user SET password = '${hash}' WHERE email = 'admin@example.com';`);
  console.log('\nOr for any user:');
  console.log(`UPDATE user SET password = '${hash}' WHERE email = 'YOUR_EMAIL';`);
});

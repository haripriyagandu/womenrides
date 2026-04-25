const twilio = require('twilio');

/**
 * Handles SMS delivery for OTP and notifications.
 * If credentials are missing, it falls back to console logging (Mock Mode).
 */
const sendOTP = async (phone, code, driverName) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const message = `SheRide: Your TRIP PIN is ${code}. Driver ${driverName} is on the way!`;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('\n--- SMS MOCK MODE ---');
    console.log(`TO: ${phone}`);
    console.log(`BODY: ${message}`);
    console.log('--- END MOCK ---\n');
    return true;
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone
    });
    console.log(`SMS Sent via Twilio to ${phone}`);
    return true;
  } catch (error) {
    console.error('Twilio Error:', error.message);
    return false;
  }
};

module.exports = { sendOTP };

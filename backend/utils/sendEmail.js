const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, text }) => {
  let transporter;

  const isProduction = process.env.SMTP_HOST && process.env.SMTP_USER;

  if (isProduction) {
    // Real SMTP (Logic to remove spaces from the app password automatically)
    const cleanPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
    
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: cleanPass,
      },
    });
  } else {
    // Ethereal Mock
    let testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"SheRide Safety" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || "Your SheRide Verification Code",
      html: html || `<div style="font-family:Arial;padding:20px;border-radius:10px;border:1px solid #eee">
        <h2 style="color:#e11d48">SheRide 🛵</h2>
        <p>Your verification code is: <strong style="font-size:24px;letter-spacing:2px;color:#2b101c">${text}</strong></p>
        <p style="color:#666;font-size:12px">If you didn't request this, please ignore it.</p>
      </div>`,
    });

    if (!isProduction) {
      console.log('\n📧 [MOCK] Email sent! Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } else {
      console.log('📧 Real Email Sent to:', to);
    }

    return { success: true, previewUrl: !isProduction ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('❌ SMTP Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;

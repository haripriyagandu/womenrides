const nodemailer = require('nodemailer');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const sendEmail = async ({ to, subject, html, text }) => {
  const isProduction = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  if (isProduction) {
    const cleanPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
    
    try {
      // PROXY VIA VERCEL SERVERLESS FUNCTION
      // Render Free Tier blocks outbound SMTP (port 465/587) entirely to prevent spam.
      // However, Vercel Serverless Functions allow outbound SMTP. 
      // So the backend simply forwards the email request to the frontend's API.
      let response = await fetch('https://womenrides.vercel.app/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text: text || html,
          user: process.env.SMTP_USER,
          pass: cleanPass
        })
      });

      if (response.status === 404) {
        response = await fetch('https://womenrides-app.vercel.app/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            text: text || html,
            user: process.env.SMTP_USER,
            pass: cleanPass
          })
        });
      }

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Vercel relay failed to send email');
      }

      console.log('Email successfully relayed through Vercel and sent to:', to);
      return { success: true };
    } catch (error) {
      console.error('SMTP Relay Error:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Ethereal Mock
    let testAccount = await nodemailer.createTestAccount();
    let transporter = nodemailer.createTransport({
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

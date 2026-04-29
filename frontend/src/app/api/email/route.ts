import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, text, user, pass } = body;

    if (!to || !user || !pass) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: user,
        pass: pass
      },
      connectionTimeout: 10000,
      socketTimeout: 10000
    });

    await transporter.sendMail({
      from: `"SheRide Security" <${user}>`,
      to,
      subject,
      text
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Vercel Email Relay Error:', error);
    return NextResponse.json({ success: false, error: error.message || error.toString() }, { status: 500 });
  }
}

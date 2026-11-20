import nodemailer from "nodemailer";

/**
 * Send 6-digit OTP via Nodemailer (Gmail SMTP)
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit OTP string
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export const sendOtp = async (email, otp) => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const emailUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : "";
  const emailPass = process.env.EMAIL_APP_PASSWORD ? process.env.EMAIL_APP_PASSWORD.trim() : "";

  // Development mode: if EMAIL_USER is missing,
  // print the OTP to console instead of sending so testing works without email setup.
  if (isDevelopment && !emailUser) {
    console.log("\n=======================================================");
    console.log(`📧 [DEV CONSOLE EMAIL] OTP for ${email}: [ ${otp} ]`);
    console.log("=======================================================\n");
    return {
      success: true,
      messageId: "dev-console-fallback",
    };
  }

  if (!emailUser || !emailPass) {
    throw new Error("EMAIL_USER or EMAIL_APP_PASSWORD is missing in environment variables.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const mailOptions = {
    from: `"RedBus Verification" <${emailUser}>`,
    to: email,
    subject: `Your RedBus Verification Code: ${otp}`,
    text: `Your OTP is ${otp}. It expires in 5 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; rounded: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #d84e55; margin: 0;">RedBus</h2>
          <p style="color: #666; font-size: 14px; margin-top: 4px;">Email Verification</p>
        </div>
        <p style="color: #333; font-size: 15px; line-height: 1.5;">
          Hello,
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.5;">
          Your One-Time Password (OTP) for RedBus account verification is:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #d84e55; background: #fff5f5; padding: 12px 28px; border-radius: 8px; border: 1px dashed #d84e55;">
            ${otp}
          </span>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          It expires in 5 minutes. Do not share it with anyone.
        </p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          If you did not request this OTP, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (isDevelopment) {
      console.log(`[Email OTP] Sent verification email to ${email}. MessageId: ${info.messageId}`);
    }
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[Email OTP Error] Failed to send email to ${email}:`, err.message);
    throw new Error(`Failed to send email OTP: ${err.message}`);
  }
};

export default sendOtp;

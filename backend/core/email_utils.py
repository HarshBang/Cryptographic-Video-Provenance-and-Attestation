import smtplib
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

def _get_smtp_config():
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_name": os.getenv("SMTP_FROM_NAME", "CVPA System"),
    }

def send_seal_confirmation(
    to_email: str,
    creator_name: str,
    filename: str,
    credential_id: str,
    sealed_at: str,
    manifest_hash: str,
):
    """Send a video seal confirmation email to the creator."""
    cfg = _get_smtp_config()

    # Log config state (mask password)
    logger.info(f"Email config — host:{cfg['host']} port:{cfg['port']} user:{cfg['user']} to:{to_email}")

    if not cfg["user"] or not cfg["password"]:
        logger.warning("SMTP_USER or SMTP_PASSWORD not set — skipping seal confirmation email")
        return
    if cfg["user"] == "your-email@gmail.com":
        logger.warning("SMTP credentials are still placeholder values — update .env with real credentials")
        return

    try:
        sealed_fmt = sealed_at
        try:
            sealed_fmt = datetime.fromisoformat(sealed_at.replace("Z", "+00:00")).strftime(
                "%B %d, %Y at %I:%M %p UTC"
            )
        except Exception:
            pass

        subject = f"Your video has been sealed — {filename}"

        html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111722;border-radius:12px;overflow:hidden;border:1px solid #1e2a3a;">
        <!-- Header -->
        <tr>
          <td style="background:#0c234b;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#a0b4d0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">CVPA System</p>
                  <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Video Sealed Successfully</h1>
                </td>
                <td align="right">
                  <span style="display:inline-block;background:#167341;color:#fff;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;letter-spacing:0.5px;">SEALED</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;color:#cbd5e1;font-size:15px;line-height:1.6;">
              Hi <strong style="color:#fff;">{creator_name}</strong>,<br><br>
              Your video has been digitally signed and registered in the CVPA provenance system.
            </p>

            <!-- Details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#192233;border-radius:8px;border:1px solid #1e2a3a;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #1e2a3a;">
                <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">File Name</p>
                <p style="margin:4px 0 0;color:#e2e8f0;font-size:14px;font-weight:600;">{filename}</p>
              </td></tr>
              <tr><td style="padding:16px 20px;border-bottom:1px solid #1e2a3a;">
                <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">Video Credential ID</p>
                <p style="margin:4px 0 0;color:#60a5fa;font-size:13px;font-family:monospace;word-break:break-all;">{credential_id}</p>
              </td></tr>
              <tr><td style="padding:16px 20px;border-bottom:1px solid #1e2a3a;">
                <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">Sealed At</p>
                <p style="margin:4px 0 0;color:#e2e8f0;font-size:14px;">{sealed_fmt}</p>
              </td></tr>
              <tr><td style="padding:16px 20px;">
                <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">Manifest Hash</p>
                <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;font-family:monospace;word-break:break-all;">{manifest_hash}</p>
              </td></tr>
            </table>

            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;line-height:1.6;">
              You can download the certificate PDF and manifest JSON from your dashboard at any time.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1e2a3a;">
            <p style="margin:0;color:#475569;font-size:12px;">CVPA Provenance System &nbsp;·&nbsp; This is an automated notification.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{cfg['from_name']} <{cfg['user']}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
            server.ehlo()
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["user"], to_email, msg.as_string())

        logger.info(f"Seal confirmation email sent to {to_email} for {credential_id}")

    except Exception as e:
        logger.error(f"Failed to send seal confirmation email to {to_email}: {e}")

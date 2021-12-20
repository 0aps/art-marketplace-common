import nodemailer from 'nodemailer';

class NodeMailer {
    constructor(mailer, options = {}) {
        this.mailer = nodemailer ?? nodemailer;
        this.transporter = this.createTransporter(options);
    }

    createTransporter(options) {
        options = options || {
            service: 'Sendgrid',
            auth: {
                user: process.env.SENDGRID_USERNAME,
                pass: process.env.SENDGRID_PASSWORD
            }
        }
        return this.mailer.createTransport(options);
    }

    send({email, subject, text}) {
        var mailOptions = {
            from: 'no-reply@artwork.com',
            to: email,
            subject: subject,
            text: text
        };

        return transporter.sendMail(mailOptions);
    }
}

export const Mailer = new NodeMailer();
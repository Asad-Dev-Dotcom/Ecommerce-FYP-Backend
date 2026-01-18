import nodemailer from "nodemailer";
import { getEnv } from "../../configs/config.js";

const transporter = nodemailer.createTransport({
  host: getEnv("NODEMAILER_HOST"),
  port: parseInt(getEnv("NODEMAILER_PORT")),
  port: 587,
  secure: false,
  // port: 465,
  // secure: true,
  auth: {
    user: getEnv("NODEMAILER_USER"),
    pass: getEnv("NODEMAILER_PASSWORD"),
  },
});

const sendMail = async (to, subject, text, html = false) => {
  try {
    if (!to || !subject || !text) throw new Error("Please Provide To, Subject and Text");
    const myTransPorter = transporter;
    // await myTransPorter.sendMail({
    //   from: getEnv("NODEMAILER_FROM"),
    //   to,
    //   subject,
    //   text: html ? undefined : text,
    //   html: html ? text : undefined,
    // });

    await new Promise((resolve, reject) => {
      myTransPorter.sendMail(
        {
          from: getEnv("NODEMAILER_FROM"),
          to,
          subject,
          text: html ? undefined : text,
          html: html ? text : undefined,
        },
        (err, info) => {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(info);
          }
        }
      );
    });
    return true;
  } catch (error) {
    console.log("error while sending mail", error);
    return false;
  }
};

export { sendMail };
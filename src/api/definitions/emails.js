/**
 * API Definitions for email service
 * This service is not intended to be used by
 * normal users.
 */
import Joi from 'joi';
import { getServerTimestamp } from 'arivaa-utils/lib/date'
import { compile } from 'handlebars';
import wkhtmltopdf from 'wkhtmltopdf';
import helpers from 'handlebars-helpers';
helpers()
/**
 * Schema for create
 * @type {{password: *, email: *}}
 */
const createSchema = {
    template: Joi.string().default(null),
    to: Joi.string().email().required(),
    subject: Joi.string().when('template', {
        is: null,
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    from: Joi.string().email().when('template', {
        is: null,
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    data: Joi.object().when('template', {
        is: null,
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    html: Joi.string().when('template', {
        is: null,
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    attachment: Joi.when('template', {
        is: null,
        then: Joi.array().items(Joi.object().required()).optional(),
        otherwise: Joi.optional()
    }),
    /**
     * Send minutes after which email will expire
     */
    expiry: Joi.number().optional(),
    generateOtp: Joi.boolean().optional()
};

/**
 * Create Method configuration
 */
const create = {
    validateSchema: createSchema,
    onBefore: async function (obj) {
        obj.generateOtp = !!obj.generateOtp;
        /**
         * Every Property defined in the main obj overrides the email type configuration
         */
        /**
         * If Email Type if defined pick template, from,expiry from the type
         */
        if (obj.expiry) {
            obj.expiryAt = obj.createdAt + obj.expiry * 60 * 1000;
            delete obj.expiry;
        }
        if (obj.attachment) {
            this.attachment = obj.attachment;
            delete obj.attachment;
        }
        if (obj.generateOtp) {
            obj.verificationCode = Math.floor(100000 + Math.random() * 900000)
        }
        obj.createdBy = obj.createdBy || "system";
    },
    onAfter: async function (output) {

        const { helper } = this;
        let { to, template, from, subject, html, key, data } = output;
        //console.log("email",data)
        const { attachment } = this;
        const { value: currency } = await this.service('configuration').get({ id: 'CURRENCY' });
        //Todo : Should pass adapter from server
        let email = await helper('email');
        if (template) {
            data = data || {};
            const { verificationCode } = output;
            if (verificationCode) {
                data.verificationCode = verificationCode;
            }
            let { subject, from, template: html, pdfTemplate } = await this.service('email-template').get({
                id: template
            });
            if (!from) {
                const { value } = await this.service('configuration').get({
                    id: 'DEFAULT_FROM_EMAIL'
                });
                from = value;
            }
            if (!from) {
                throw {
                    status: 404,
                    message: 'From Email is not passed in template and in configuration'
                }
            }
            data.emailKey = key;
            data.currency = currency;
            const attachment = [];
            if (pdfTemplate && pdfTemplate !== 'empty') {
                const { name, template } = await this.service('pdf-template').get({
                    id: pdfTemplate
                });
                let obj = {
                    filename: compile(name)(data) + '.pdf',
                    data: Buffer.concat(await readStream(await convertImagesAndFontsToBase64(compile(template)(data)), 'A4')),              
                };
                obj.content = obj.data;
                attachment.push(obj)
            }
            if (email.send instanceof Function) {
                await email.send({
                    from,
                    to,
                    subject: compile(subject)(data),
                    html: compile(html)(data),
                    attachments : attachment
                });
            } else if (email.sendMail instanceof Function) {
                await email.sendMail({
                    from,
                    to,
                    subject: compile(subject)(data),
                    html: compile(html)(data),
                    attachment
                })
            } else {
                throw {
                    status: 404,
                    message: 'no supported send function defined'
                }
            }
        } else {
            if (email.send instanceof Function) {
                await email.send({
                    from,
                    to,
                    subject: compile(subject)(data),
                    html: compile(html)(data),
                    attachment
                });
            } else if (email.sendMail instanceof Function) {
                await email.sendMail({
                    from,
                    to,
                    subject: compile(subject)(data),
                    html: compile(html)(data),
                    attachments: attachment
                })
            } else {
                throw {
                    status: 404,
                    message: 'no supported send function defined'
                }
            }
        }
    }
};

export async function readStream(html, pageSize) {
    if (typeof pageSize === 'string') {
        pageSize = { pageSize };
    }
    return await new Promise(((resolve, reject) => {
        try {
            const stream = wkhtmltopdf(html, pageSize);
            let buffer = [];
            stream.on('data', data => {
                buffer.push(data);
            });
            stream.on('end', () => {
                resolve(buffer);
            });
            stream.on('error', e => {
                reject(e);
            });
        } catch (e) {
            reject(e);
        }
    }));
}
/**
 * Convert img srcs to base64 for pdfs
 * @param {*} html 
 */
export async function convertImagesAndFontsToBase64(html, fonts, css) {
    fonts = fonts || [];
    css = css || [];
    let m;
    let newHtml = html;
    let urls = [];
    const imageRegex = /<img[^>]+src="?([^"\s]+)"?\s*\/>/g;
    const request = require('request').defaults({ encoding: null });
    while (m = imageRegex.exec(newHtml)) {
        urls.push(m[1]);
    }
    urls = [...urls, ...fonts]
    await Promise.all(urls.map((url) => {
        return new Promise((resolve, reject) => {
            request.get(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    const data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
                    html = html.replace(url, data);
                    resolve(data);
                } else {
                    resolve(null);
                }
            });
        })
    }));
    return html;
}
const test = {
    security: {
        role: 'admin'
    },
    method: 'POST',
    callback: async function (req) {
        await Joi.validate(req.body, Joi.object().keys({
            template: Joi.string().required(),
            to: Joi.string().required()
        }));
        const { template, to } = req.body;
        const { subject, from, template: html, pdfTemplate } = await this.service('email-template').get({
            id: template
        });
        const attachment = [];
        if (pdfTemplate && pdfTemplate !== 'empty') {
            try {
                const { name, template } = await this.service('pdf-template').get({
                    id: pdfTemplate
                });
                attachment.push({
                    filename: name + '.pdf',
                    data: Buffer.concat(await readStream(await convertImagesAndFontsToBase64(template), 'A4'))
                });
            } catch (e) {
                console.log(e);
            }
        }
        const email = await this.helper('email');        
        if (email.send instanceof Function) {
            await email.send({
                from,
                to,
                subject,
                html,
                attachment
            });
        } else if (email.sendMail instanceof Function) {
            await email.sendMail({
                from,
                to,
                subject,
                html,
                attachments: attachment
            })
        } else {
            throw {
                status: 404,
                message: 'no supported send function defined'
            }
        }
    }
};
export default {
    create,
    // remove: false,
    security: {
        role: "admin"
    },
    additionalPaths: {
        test
    }
};

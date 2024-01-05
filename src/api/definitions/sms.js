import Joi from 'joi';
import { compile } from 'handlebars';
const createSchema = {
    to: Joi.string().required(),
    template: Joi.string().required(),
    data: Joi.object()
};
const create = {
    validateSchema: createSchema,
    onAfter: async function (output) {
        const { to, template, data } = output;
        let { from, template: content } = await this.service('sms-template').get({
            id: template
        });
        if(!from){
            const {value}=await this.service('configuration').get({
                id:'DEFAULT_FROM_PHONE'
            });
            from=value;
        }
        if(!from){
            throw {
                status:404,
                message:'From is missing'
            }
        }
        if(!this.helper('sms')){
            throw {
                status:404,
                message:'SMS Helper is missing'
            }
        }
        const sms = await this.helper('sms');
        await sms.send({
            from,
            to,
            body:compile(content)(data)
        });
    }
};
const test={
    security:{
        role:'admin'
    },
    method:'POST',
    callback:async function(req){
        await Joi.validate(req.body, Joi.object().keys({
            template: Joi.string().required(),
            to: Joi.string().required()
        }));
        const { template, to } = req.body;
        const { from, template: content } = await this.service('sms-template').get({
            id: template
        });
        const sms = await this.helper('sms');
        await sms.send({
            from,
            to,
            body:content
        });
    }
};
export default {
    security: {
        role: 'admin'
    },
    create,
    additionalPaths:{
        test
    }
}
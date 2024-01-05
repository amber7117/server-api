import Joi from 'joi';
const createSchema={
    key:Joi.string().required(),
    from:Joi.string().optional().allow('',null),
    template:Joi.string().required(),
    templateVariables:Joi.string().allow('',null)
};
const updateSchema={
    from:Joi.string().optional().allow('',null),
    template:Joi.string(),
    templateVariables:Joi.string().allow('',null)
};
const create={
    validateSchema:createSchema,
    onBefore:async function(input){
        const { key } = input;
        let isExist = false;
        try {
            await this.service(this.key).get({
                id: key
            });
            isExist = true;
        } catch (e) {

        }
        if (isExist) {
            throw {
                status: 404,
                message: 'SMS Template Already Exist'
            }
        }
    }
};
const update={
    validateSchema:updateSchema
};
const duplicate = {
    security: {
        role: 'admin'
    },
    method: 'POST',
    callback: async function (req) {
        await Joi.validate(req.body, Joi.object().keys({
            id: Joi.string().required(),
            key: Joi.string().required()
        }));
        const { id, key } = req.body;
        const { createdAt, createdBy, updatedAt, updatedBy, path,...data } = await this.service(this.key).get({
            id
        });
        await this.service(this.key).create({
            ...data,
            key
        });
    }
};
export default {
    create,
    update,
    indexingConfig:{
        fields:['key','from']
    },
    additionalPaths:{
        duplicate
    }
}
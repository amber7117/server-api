import Joi from 'joi';
const createSchema = {
    key: Joi.string().required(),
    value: Joi.string().required(),
    description: Joi.string().required()
};
const updateSchema = {
    value: Joi.string(),
    description: Joi.string()
};
const create = {
    validateSchema: createSchema
};
const update = {
    validateSchema: updateSchema
};
export default {
    create,
    update,
    indexingConfig:{
        fields:['key']
    }
};
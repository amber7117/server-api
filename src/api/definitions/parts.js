import Joi from 'joi'

const createSchema = {
    make: Joi.string().required(),
    model: Joi.string().optional().allow('',null),
    colour: Joi.string().optional().allow('',null),
    variant: Joi.string().optional().allow('',null),
    name: Joi.string().required(),
    description: Joi.string().optional().allow('',null),
    price: Joi.number().required(),
    product: Joi.array().items(Joi.string()).optional().allow([],null),
    enabled: Joi.boolean()
}

const updateSchema = {
    make: Joi.string(),
    model: Joi.string(),
    colour: Joi.string(),
    variant: Joi.string(),
    name: Joi.string(),
    description: Joi.string(),
    price: Joi.number(),
    product: Joi.array().items(Joi.string()),

    enabled: Joi.boolean()
}

const create = {
    validateSchema: createSchema
}

const update = {
    validateSchema: updateSchema
}

export default {
    security: {
        defaultPermissions : true
    },
    create,
    update,
    indexingConfig: {
        fields: ['key', 'make', 'model']
    }
}
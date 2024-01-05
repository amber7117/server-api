import Joi from "joi"

const createSchema = {
    question: Joi.string().required(),
    answer: Joi.string().required()
}

const updateSchema = {
    question: Joi.string().optional(),
    answer: Joi.string().optional()
}

const create = {
    validateSchema: createSchema
}

const update = {
    validateSchema: updateSchema
}

export default {
    security: {
        role: 'admin'
    },
    create,
    update,
    indexingConfig: {
        fields: ['key']
    }
}

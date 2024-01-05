/**
 * API Definitions for email service
 * This service is not intended to be used by
 * normal users.
 */
import Joi from 'joi';

/**
 * Schema for create
 * @type {{password: *, email: *}}
 */
const createSchema = {
    code: Joi.string().required().regex(/^[a-z0-9]+$/i),
    description: Joi.string().required(),
    parentRole: Joi.string().optional(),
    permissions: Joi.array().items(Joi.string().optional()).allow([])
};

/**
 * Create Method configuration
 */
const create = {
    validateSchema: createSchema,
    onBefore: async function (input) {
        input.code = input.code.toUpperCase();
        const { code } = input;
        //Make sure index on roles is created
        const { data } = await this.service('roles').find({
            searchField: 'code',
            search: code,
            from: -1,
            operator: "equals"
        });
        if (data.length > 0) {
            throw {
                status: 409,
                message: "Role with this code already exists"
            }
        }
    }
};

/**
 * Schema for update
 * @type {{password: *, email: *}}
 */
const updateSchema = {
    description: Joi.string().optional(),
    parentRole: Joi.string().optional(),
    permissions: Joi.array().items(Joi.string().optional()).allow([])
};


/**
 * Update Method configuration
 */
const update = {
    validateSchema: updateSchema,
};

const getPermission = {
    security: true,
    method: 'GET',
    callback: async function (req) {
        const { role } = req.user;
        const { data:[{permissions}] } = await this.service('roles').find({
            search:role,
            searchField:'code'
        });
        return await Promise.all(permissions.map(async id => {
            return await this.service('permission').get({ id });
        }))
    }
};
//todo : We need to somehow rank the roles, A role with lower rank should not be able to remove the other roles. so as of now exposing this functionality only for admin
export default {
    create,
    security: {
        role: "admin"
    },
    update,
    indexingConfig: {
        fields: ['code', 'description']
    },
    additionalPaths: {
        getPermission
    }
};

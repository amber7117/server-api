import Joi from 'joi';
const createSchema={
    key:Joi.string().required(),
    description:Joi.string().required(),
    requiredPermissions : Joi.array().items(Joi.string().optional()).allow([])
};
const create={
    validateSchema:createSchema,
    onBefore:async function(input){
        const {key}=input;
        let isExist=false;
        try {
            await this.service(this.key).get({
                id: key
            });
            isExist=true;
        } catch (e) {
            console.log(e);
        }
        if(isExist){
            throw {
                status: 409,
                message: 'Entity Already Exists'
            }
        }
    }
};
const updateSchema={
    description:Joi.string(),
    requiredPermissions : Joi.array().items(Joi.string().optional()).allow([])
};
const update={
    validateSchema:updateSchema
}
export default{
    create,
    update,
    indexingConfig:{
        fields:['key']
    }
};
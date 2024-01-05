/**
 * API Definitions for registration of user
 */
const Joi = require("joi");
/**
 * Schema for create
 * @type {{password: *, email: *}}
 */
const createSchema = {
  type: Joi.valid('local', 'social').required(),
  firstName: Joi.string().when('type', {
    is: 'local',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  lastName: Joi.string().when('type', {
    is: 'local',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  email: Joi.when('type', {
    is: 'local',
    then: Joi.string().email().required(),
    otherwise: Joi.optional()
  }),
  password: Joi.string().when('type', {
    is: 'local',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  uid: Joi.string().when('type', {
    is: 'social',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
};
/**
 * Create Method configuration
 */
const create = {
  method: async function (obj) {
    const { email, password, firstName, lastName, type, uid } = obj;
    let user;
    let response;
    if (type === 'social') {
      const userAuth = await this.firebaseAdmin.getUserAuth(uid);
      const { providerData, displayName, email } = userAuth;
      const [{ providerId }] = providerData;
      if (providerId === 'password') {
        throw {
          status: 400,
          message: 'This user is not a Social User'
        }
      }
      const userProfile = await this.firebaseAdmin.getUserById(uid);
      if (!userProfile) {
        user = {
          uid,
          type,
          name: displayName,
          email,
          providerId,
          emailVerified: true
        }
      } else {
        response = {
          ...userProfile,
          ...userAuth
        }
      }
    } else {
      const name = firstName + " " + lastName;
      user = {
        email,
        password,
        type: 'local',
        name,
        emailVerified: !this.config.confirmNewRegistration
      }
    }
    /**
     * Scenario of social user already exists
     */
    if(response){
      return response;
    } else {
      //Create new User
      response = await this.service("users").create(user);
    }
    /**
     * Local User - Confirm New User Registration if enabled
     */
    if (this.config.confirmNewRegistration && type === "local") {
      /**
       * if verificationCode is returned it means a otp based flow
       */
      let promise = this.service("confirm-email").create({
        name: response.displayName,
        email: response.email,
        uid: response.uid,
      });
      if (this.config.email.types["confirmEmail"].generateOtp) {
        const { key, verificationCode } = await promise;

        if (verificationCode) {
          response.confirmationKey = key;
        }
      }
      /**
       * Else Send out a welcome email.
       */
    } else if (response.email) {
      /**
       * User is already by default confirmed, Send out a welcome email
       */
      this.service("emails").create({
        to: response.email,
        template: "WelcomeUser",
        data: {
          displayName: response.displayName || "User",
          link: await this.helper("generateWebClientLink")("login")
        }
      });
    }
    return response;
  },
  validateSchema: createSchema
};
export default {
  create,
  disableNotDefinedMethods: true
};

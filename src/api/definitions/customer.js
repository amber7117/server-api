import Joi from "joi";
import {
  checkServiceKeyDuplicacy,
  checkValidKeyInServiceForMany,
  getRecord,
} from "../helpers/common";
const createSchema = {
  key: Joi.string().required(),
  customerName: Joi.string().required(),
  address: Joi.string().required(),
  homeNumber: Joi.string().optional().allow("", null),
  officeNumber: Joi.string().optional().allow("", null),
  email: Joi.string().required(),
  products: Joi.array().items(Joi.string()).allow([], null),
  createUser: Joi.boolean(),
};
const updateSchema = {
  //corporateNumber: Joi.string(),
  customerName: Joi.string(),
  address: Joi.string(),
  homeNumber: Joi.string().allow("", null),
  key: Joi.string(),
  officeNumber: Joi.string().allow("", null),
  email: Joi.string(),
  products: Joi.array().items(Joi.string()).allow([], null),
  userUid: Joi.string(),
};
const create = {
  validateSchema: createSchema,
  onBefore: async function (input, req, res) {
    await checkServiceKeyDuplicacy.apply(this, ["customer", input, "customer"]);
    await checkValidKeyInServiceForMany.apply(this, [
      "products",
      input.products || [],
    ]);
    if (input.createUser) {
      req.createUser = input.createUser;
      delete input["createUser"];
    }
  },
  onAfter: async function (output, input, req, res) {
    const { key } = output;
    let userResponse;
    let password = Math.random().toString(36).slice(-10);
    if (req && req.createUser) {
      userResponse = await this.service("users").create(
        {
          type: "local",
          name: output.customerName,
          role: "CUSTOMER",
          email: output.email,
          password,
        },
        true
      );
    }
    if (userResponse) {
      await this.service("customer").update({
        id: key,
        data: {
          userUid: userResponse.uid,
        },
      });
    }
  },
};
/**
 *  In on after we are getting the products and displaying with the products
 */
let get = {
  onAfterEach: async function (output, id) {
    if (output.products && output.products.length) {
      try {
        output.products = await this.service("products").get({
          id: output.products.join(","),
        });
      } catch (e) {
        console.error("Error while getting products for customer", { e, id });
        output.products = [];
      }
    }
  },
};
/**
 * Like get we are fetching the products and displaying it with the customers
 */
let find = {
  onAfter: async function (output) {
    if (output.data && output.data.length) {
      output.data = await Promise.all(
        output.data.map(async (customer) => {
          customer = {
            ...customer,
          };
          if (customer.products && customer.products.length) {
            try {
              customer.products = await this.service("products").get({
                id: customer.products.join(","),
              });
            } catch (e) {
              console.error("Error while getting products for customer", {
                e,
                customer,
              });
              customer.products = [];
            }
          }
          return customer;
        })
      );
    }
  },
};
const update = {
  overrideIfNotExist: true,
  validateSchema: updateSchema,
  onBefore: async function (input) {
    const { id, data } = input;
    const { key } = data;
    if (key && key !== id) {
      // getting old customer
      const {
        updatedAt,
        updatedBy,
        createdAt,
        createdBy,
        userUid,
        ...customer
      } = await this.service("customer").get({
        id,
      });
      // creating new customer
      await this.service("customer").create({
        ...customer,
        products: customer.products.map(({ key }) => {
          return key;
        }),
        key,
      });
      input.id = key;
      input.data = {
        ...customer,
        ...data,
      };
      // deleting old customer
      await this.service("customer").remove({
        id,
      });
      if (userUid) {
        /**
         * Attach User to customer
         */
        this.service("customer").update({
          id: key,
          data: {
            userUid,
          },
        });
      }
      /**
       * Async - Shift User, Jobs and invoices and remove previous customer
       */
      setTimeout(async () => {
        try {
          console.debug(
            "Shifting data from old phone number to new phone number ",
            { id, customer, userUid }
          );
          const customerJobs = (
            await this.service("service").find({
              search: id,
              searchField: "customerKey",
              operator: "equals",
              from: -1,
            })
          ).data;
          const customerInvoices = (
            await this.service("invoice").find({
              search: id,
              searchField: "customerKey",
              operator: "equals",
              from: -1,
            })
          ).data;
          await Promise.all( 
            customerJobs.map(async ({ key: jobKey }) => {
              try {
                await this.service("service").update({
                  id: jobKey,
                  data: {
                    customer: key,
                  },
                });
              } catch (e) {
                console.error("Error while updating job with new phone", {
                  e,
                  jobKey,
                });
              }
            })
          );
          console.debug("Migrated Jobs - " + customerJobs.length);
          await Promise.all(
            customerInvoices.map(async ({ key: invoiceKey }) => {
              try {
                await this.service("invoice").update({
                  id: invoiceKey,
                  data: {
                    customer: key,
                  },
                });
              } catch (e) {
                console.error("Error while updating invoice with new phone", {
                  e,
                  invoiceKey,
                });
              }
            })
          );
          console.debug("Migrated invoices - " + customerInvoices.length);
        } catch (e) {
          console.error(
            "Error while shifting data from old phone to new phone ",
            { e, id, data }
          );
        }
      });
    }
  },
};
export default {
  security: {
    defaultPermissions: true,
  },
  indexingConfig: {
    fields: ["customerName", "key", "userUid"],
  },
  create,
  update,
  get,
  remove: {
    onBeforeEach: async function (id, obj, req) {
      const removeUserAndJobsAndInvoices = () => {
        setTimeout(async () => {
          console.debug("Removing customer with phone - " + id);
          const customer = await getRecord.apply(this, ["customer", id]);
          if (customer) {
            const customerJobs = await this.service("service").find({
              search: id,
              searchField: "customerKey",
              operator: "equals",
              from: -1,
            });
            const customerInvoices = await this.service("invoice").find({
              search: id,
              searchField: "customerKey",
              operator: "equals",
              from: -1,
            });
            if (customer.userUid) {
              console.debug("Removing user for customer");
              await this.service("users").remove({
                id: customer.userUid,
              });
            }
            if (customerJobs && customerJobs.total > 0) {
              console.debug(
                "Removing jobs for customer, count - ",
                customerJobs.total
              );
              await this.service("service").remove({
                id: customerJobs.data
                  .map(({ key }) => {
                    return key;
                  })
                  .join(","),
              });
            }
            if (customerInvoices && customerInvoices.total > 0) {
              console.debug(
                "Removing invoices for customer, count - ",
                customerInvoices.total
              );
              await this.service("invoice").remove({
                id: customerInvoices.data
                  .map(({ key }) => {
                    return key;
                  })
                  .join(","),
              });
            }
          }
        });
      };
      req && removeUserAndJobsAndInvoices();
    },
  },
  find,
};

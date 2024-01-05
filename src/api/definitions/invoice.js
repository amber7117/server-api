import Joi, { func } from "joi";
import { formatDate } from "../../utils/date";
import moment from 'moment'
import { checkValidKeyInService } from "../helpers/common";
import {
  getServiceCostSummary,
  customerFilter,
  engineerFilter,
} from "./service";
const createSchema = {
  key: Joi.string().required(),
};
function pad(str, max) {
  str = str.toString();
  return str.length < max ? pad("0" + str, max) : str;
}
const create = {
  validateSchema: createSchema,
  onBefore: async function (input) {
    const { key } = input;
    let service;
    service = await checkValidKeyInService.apply(this, ["service", key]);    
    Object.keys(service || {}).forEach((key) => {
      input[key] = service[key];
    });
    const invoiceNumber = await this.firebaseAdmin.getRecord("/invoiceNumber");

    input.id = `INV${new Date().getFullYear()}${pad((invoiceNumber || 0) + 1, 4)}`;
    const costSummary = getServiceCostSummary(service);
    Object.keys(costSummary).forEach((objKey) => {
      input[objKey] = costSummary[objKey];
    });
    input.generatedDate = new Date().toLocaleString();
  },
  onAfter: async function (output) {
    await this.firebaseAdmin.incrementValueAtLocation("/invoiceNumber");
    const { key } = output;
    let customerPhoneForMessage, customerNameForMessage;
    //const costSummary = getServiceCostSummary(output);
    if (typeof output.customer === "string") {
      output.customerKey = output.customer;
      output.customer = await this.service("customer").get({
        id: output.customer,
      });
      output.customer.key = output.customerKey;
      customerPhoneForMessage = output.customerKey;
      customerNameForMessage = output.customer.customerName;
    } else {
      output.customerKey = output.customer.key;
      customerPhoneForMessage = output.customer.key;
      customerNameForMessage = output.customerName;
    }
    if (output.customer.email) {
      const data = await this.service("configuration").get({
        id: "HOST,INVOICELOGO",
      });
      this.service("emails").create({
        to: output.customer.email,
        template: "InvoiceCreate",
        data: {
          ...output,
          ...output.customer,
          invoiceKey: key,
          //...costSummary,
          host: data[0].value,
          invoiceLogo: data[1].value,
          date: formatDate(output.updatedAt, "DD/MM/YYYY"),
        },
      });
    }
    if (customerPhoneForMessage) {
      const data = await this.service("configuration").get({
        id: "CURRENCY,HOST",
      });
      let currency, host;
      if (data && data.length) {
        currency = data[0].value;
        host = data[1].value;
      }

      this.service("sms").create({
        to: customerPhoneForMessage,
        template: "InvoiceCreate",
        data: {
          customerName: customerNameForMessage,
          currency: currency || "",
          serviceKey: output.key,
          invoiceKey: output.id,
          host,
          ...output,
          //...costSummary
        },
      });
    }
  },
};

async function sendInvoice(id) {
  let invoice = await this.service("invoice").get({
    id,
  });
  const { customer } = invoice;
  //const costSummary = getServiceCostSummary(invoice);
  const data = await this.service("configuration").get({
    id: "HOST,INVOICELOGO,CURRENCY",
  });
  if (typeof customer === "string") {
    invoice.customer = await this.service("customer").get({
      id: customer,
    });
  }
  this.service("emails").create({
    to: invoice.customer.email,
    template: "InvoiceCreate",
    data: {
      invoiceKey: id,
      ...invoice,
      host: data[0].value,
      invoiceLogo: data[1].value,
      //...costSummary,
      paid: !!invoice.payment,
    },
  });
  this.service("sms").create({
    to: invoice.customerKey,
    template: "InvoiceCreate",
    data: {
      ...invoice,
      customerName: invoice.customerName,
      currency: data[2].value || "",
      serviceKey: invoice.key,
      invoiceKey: invoice.id,
      host: data[0].value,
      //...costSummary,
      paid: !!invoice.payment,
    },
  });
}
const updateSchema = {
  payment: Joi.object().optional(),
  paid: Joi.boolean().optional(),
  customer: Joi.string().optional(),
};
const update = {
  validateSchema: updateSchema,
};
export default {
  security: {
    role: "admin",
  },
  create,
  update,
  find: {
    validateSchema: {
      current: Joi.boolean(),
    },
    security: {
      permissions: ["INVOICE_READ", "MY-INVOICES_READ"],
    },
  },
  additionalPaths: {
    stats: {
      callback: async function (obj) {
        const invoices = (await this.service("invoice").find({ from: -1 })).data
        
        let stats = {
          paid: {
            year: { amount: 0, count: 0 },
            month: { amount: 0, count: 0 },
          },
          unpaid: {
            year: { amount: 0, count: 0 },
            month: { amount: 0, count: 0 },
          },
        };
        invoices.forEach(({ createdAt, paid, totalPayable }) => {
          if(moment(createdAt).isSame(new Date(),'year')){
            if (paid) {
              stats.paid.year.amount += parseFloat(totalPayable);
              stats.paid.year.count++;
            } else {
              stats.unpaid.year.amount += parseFloat(totalPayable);
              stats.unpaid.year.count++;
            }
          }
          if(moment(createdAt).isSame(new Date(),'month')){
            if (paid) {
              stats.paid.month.amount += parseFloat(totalPayable);
              stats.paid.month.count++;
            } else {
              stats.unpaid.month.amount += parseFloat(totalPayable);
              stats.unpaid.month.count++;
            }
          }
        });
        return stats;
      },
    },
    sendInvoice: {
      method: "POST",
      callback: async function (req, res) {
        //checkRoleAuthorization("admin", req, res);
        Joi.validate(
          req.query,
          Joi.object().keys({
            id: Joi.string().required(),
          })
        );
        const { id } = req.query;
        await sendInvoice.apply(this, [id]);
        return true;
      },
      security: {
        permissions: ["INVOICE_MANAGE"],
      },
    },
    markAsPaid: {
      method: "POST",
      callback: async function (req, res) {
        //checkRoleAuthorization("admin", req, res);
        Joi.validate(
          req.query,
          Joi.object().keys({
            id: Joi.string().required(),
          })
        );
        const { id } = req.query;
        const invoice = await this.service("invoice").get({ id });
        if (!invoice.paid) {
          await this.service("invoice").update({
            id,
            data: {
              //paid: true,
              payment: {
                status: "Marked Manually by user",
              },
            },
          });
        }
        return true;
      },
      security: {
        permissions: ["INVOICE_MANAGE"],
      },
    },
    billTo: {
      method: "POST",
      callback: async function (req, res) {
        // checkRoleAuthorization("admin", req, res);
        await Joi.validate(
          { ...req.body, ...req.query },
          Joi.object().keys({
            billTo: Joi.string().required(),
            email: Joi.string().required(),
            phoneNo: Joi.string(),
            id: Joi.string().required(),
          })
        );
        const { id } = req.query;
        const { billTo, email } = req.body;
        const invoice = await this.service("invoice").get({
          id,
        });
        const { customer } = invoice;
        if (typeof customer === "string") {
          invoice.customer = await this.service("customer").get({
            id: customer,
          });
        }
        //const costSummary = getServiceCostSummary(invoice);
        const sendEmail = async () => {
          const data = await this.service("configuration").get({
            id: "HOST,INVOICELOGO",
          });
          this.service("emails").create({
            to: email,
            template: "InvoiceCreate",
            data: {
              host: data[0].value,
              invoiceLogo: data[1].value,
              ...invoice,
              //...costSummary,
              invoiceKey: id,
              billTo,
            },
          });
        };
        sendEmail();
        if (req.body.phoneNo) {
          const configrationData = await this.service("configuration").get({
            id: "HOST,CURRENCY",
          });
          this.service("sms").create({
            to: req.body.phoneNo,
            template: "InvoiceCreate",
            data: {
              ...invoice,
              customerName: req.body.billTo,
              currency: configrationData[1].value || "",
              serviceKey: invoice.key,
              invoiceKey: invoice.id,
              host: configrationData[0].value,
              paid: !!invoice.payment,
              //...costSummary
            },
          });
        }
        return true;
      },
      security: {
        permissions: ["INVOICE_MANAGE"],
      },
    },
    paymentInfo: {
      callback: async function (req, res) {
        Joi.validate(
          req.query,
          Joi.object().keys({
            id: Joi.string().required(),
          })
        );
        const {
          id,
          payment,
          jobNumber,
          key,
          totalPayable,
          customerName,
          customerKey,
          email,
        } = await this.service("invoice").get({
          id: req.query.id,
        });
        return {
          id,
          payment: payment
            ? {
                method: payment.method,
              }
            : undefined,
          jobNumber,
          key,
          totalPayable,
          customerName,
          phoneNumber: customerKey,
          email,
        };
      },
      security: false,
    },
    process: {
      method: "POST",
      callback: async function (req, res) {
        Joi.validate(
          req.body,
          Joi.object().keys({
            payment: Joi.object().required(),
            id: Joi.string().required(),
          })
        );
        const { payment, id } = req.body;
        await this.service("transaction").create({
          ...payment,
        });
        await this.service("invoice").update({
          data: {
            payment,
            paid: true,
          },
          id,
        });
      },
      security: false,
    },
  },
  indexingConfig: async function (input, req) {
    let preFilter;
    if (req) {
      const { uid, role } = req.user;
      if (role !== "admin") {
        /**
         * Current Jobs are requested, Customer will
         * have their jobs and others will have their assigned Jobs
         */
        if (req.query.current) {
          if (role === "CUSTOMER") {
            const {
              data: [customer],
            } = await this.service("customer").find({
              searchField: "userUid",
              search: uid,
            });
            const { key } = customer || {};
            preFilter = function (item) {
              return customerFilter(item, key);
            };
          } else {
            preFilter = function (item) {
              return engineerFilter(item, uid);
            };
          }
        } else {
          /**
           * All jobs are requested, Must have Invoices
           */
          if ((req.user.permissions || []).indexOf("INVOICE_READ") === -1) {
            throw {
              status: 403,
              message: "You only have access to your own invoices",
            };
          }
        }
      }
    }
    return {
      fields: [
        "customerName",
        "mobileNumber",
        "createdDate",
        "id",
        "paid",
        "customerKey",
      ],
      preFilter,
      populate: async function (output) {
        const { key } = output;
        try {
          if (!output.customer) {
            output = {
              ...(await this.service("invoice").get({
                id: key,
              })),
              ...output,
            };
          }
          if (typeof output.customer !== "object") {
            const customer = await this.service("customer").get({
              id: output.customer,
            });
            customer.mobileNumber = customer.key;
            delete customer.key;
            delete customer.createdAt;
            delete customer.updatedAt;
            output = {
              ...output,
              ...customer,
              createdDate: formatDate(output.createdAt),
            };
          }
          output.timestamp = new Date(output.date).getTime();
          output.paid = !!output.payment;
          output.key = key;
          return output;
        } catch (e) {
          console.log("Error while populating invoice- ", e, output);
        }
      },
    };
  },
};

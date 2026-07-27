import Joi from "joi";

const propertyValidation = Joi.object({
  purpose: Joi.string().valid("Sell", "Rent").required().messages({
    "any.required": "Purpose is required",
    "any.only": "Purpose must be either Sell or Rent",
  }),
  category: Joi.string().valid("Home", "Plots", "Commercial").required().messages({
    "any.required": "Category is required",
    "any.only": "Category must be Home, Plots, or Commercial",
  }),
  propertyType: Joi.string().required().messages({
    "any.required": "Property Type is required",
  }),
  city: Joi.string().required().messages({
    "any.required": "City is required",
  }),
  location: Joi.string().required().messages({
    "any.required": "Location is required",
  }),
  areaSize: Joi.number().positive().required().messages({
    "any.required": "Area Size is required",
    "number.positive": "Area Size must be a positive number",
  }),
  areaUnit: Joi.string().required().messages({
    "any.required": "Area Unit is required",
  }),
  price: Joi.number().positive().required().messages({
    "any.required": "Price is required",
    "number.positive": "Price must be a positive number",
  }),
  currency: Joi.string().required().messages({
    "any.required": "Currency is required",
  }),
  installment: Joi.boolean().default(false),
  readyForPossession: Joi.boolean().default(false),
  bedrooms: Joi.string().allow("").optional(),
  bathrooms: Joi.string().allow("").optional(),
  amenities: Joi.array().items(Joi.string()).default([]),
  title: Joi.string().required().messages({
    "any.required": "Title is required",
  }),
  description: Joi.string().required().messages({
    "any.required": "Description is required",
  }),
  images: Joi.array().items(Joi.string()).default([]),
  mobile: Joi.string().required().messages({
    "any.required": "Mobile number is required",
  }),
  landline: Joi.string().allow("").optional(),
});

export { propertyValidation };

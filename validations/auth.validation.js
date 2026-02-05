import Joi from "joi";

const signUpValidation = Joi.object({
  email: Joi.string().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please enter a valid email",
  }),
  password: Joi.string().min(8).max(8).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must be at most 8 characters long",
    "string.pattern": "Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character",
  }).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
  confirmPassword: Joi.string().min(8).max(8).required().messages({
    "any.required": "Confirm Password is required",
    "string.min": "Confirm Password must be at least 8 characters long",
    "string.max": "Confirm Password must be at most 8 characters long",
    "string.pattern": "Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character",
  }).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
});

const loginValidation = Joi.object({
  email: Joi.string().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Email must be a valid email address",
  }),
  password: Joi.string().min(8).max(8).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must be at most 8 characters long",
    "string.pattern": "Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character",
  }).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
});

const changePasswordValidation = Joi.object({
  password: Joi.string().min(8).max(8).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must be at most 8 characters long",
    "string.pattern": "Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character",
  }).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
  confirmPassword: Joi.string().min(8).max(8).required().messages({
    "any.required": "Confirm Password is required",
    "string.min": "Confirm Password must be at least 8 characters long",
    "string.max": "Confirm Password must be at most 8 characters long",
    "string.pattern": "Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character",
  }).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
});

export { signUpValidation, loginValidation, changePasswordValidation };
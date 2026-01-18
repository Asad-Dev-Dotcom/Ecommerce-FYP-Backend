import bcrypt from "bcrypt";
import { isValidObjectId } from "mongoose";
import { getEnv } from "../configs/config.js";
import { Auth } from "../models/auth.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { returnMailPage } from "../utils/htmlPages.js";
import { JWTService } from "../utils/jwtService.js";
import { sendMail } from "../utils/sendMail.js";
import { sendToken } from "../utils/sendToken.js";
import {
removeFromCloudinary,
uploadOnCloudinary,
} from "../utils/cloudinary.js";
import {
accessTokenOptions,
refreshTokenOptions,
} from "../configs/constants.js";

// create admin
// -----------
const register = asyncHandler(async (req, res, next) => {
  if (!req?.body)
    return next(new CustomError(400, "Please provide all required fields"));

  const { name, email, password, phone, gender, companyName, designation } =
    req.body;

  if (!name || !email || !password) {
    return next(new CustomError(400, "Name, Email and Password are required"));
  }

  const existingUser = await Auth.findOne({ email });
  if (existingUser?._id)
    return next(new CustomError(403, "Email already exists"));

  let imageData = null;
  if (req.file) {
    const uploadedImage = await uploadOnCloudinary(req.file, "auth");
    if (!uploadedImage)
      return next(new CustomError(400, "Error while uploading image"));
    imageData = {
      public_id: uploadedImage.public_id,
      url: uploadedImage.secure_url,
    };
  }

  const newUser = await Auth.create({
    name,
    email,
    password,
    phone,
    role: "admin",
    gender,
    companyName,
    designation,
    image: imageData,
  });

  if (!newUser)
    return next(new CustomError(400, "Error while registering user"));

  await sendToken(
    res,
    next,
    newUser,
    201,
    "Your account registered successfully"
  );
});

// sign user
// -----------
const signup = asyncHandler(async (req, res, next) => {
  if (!req?.body)
    return next(new CustomError(400, "Please provide all required fields"));

  const { name, email, password, phone, gender, companyName, designation } =
    req.body;

  if (!name || !email || !password) {
    return next(new CustomError(400, "Name, Email and Password are required"));
  }

  const existingUser = await Auth.findOne({ email });
  if (existingUser?._id)
    return next(new CustomError(403, "Email already exists"));

  let imageData = null;
  if (req.file) {
    const uploadedImage = await uploadOnCloudinary(req.file, "auth");
    if (!uploadedImage)
      return next(new CustomError(400, "Error while uploading image"));
    imageData = {
      public_id: uploadedImage.public_id,
      url: uploadedImage.secure_url,
    };
  }

  const newUser = await Auth.create({
    name,
    email,
    password,
    phone,
    role: "client",
    gender,
    companyName,
    designation,
    image: imageData,
  });

  if (!newUser)
    return next(new CustomError(400, "Error while registering user"));

  await sendToken(
    res,
    next,
    newUser,
    201,
    "Your account registered successfully"
  );
});

// login
// -------
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new CustomError(400, "Please provide both email and password"));
  }

  const user = await Auth.findOne({ email }).select("+password");
  if (!user) {
    return next(new CustomError(400, "Wrong email or password"));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return next(new CustomError(400, "Wrong email or password"));
  }

  await sendToken(res, next, user, 200, "Logged in successfully");
});

// logout
// ---------
const logout = asyncHandler(async (req, res, next) => {
  const refreshToken = req?.cookies?.[getEnv("REFRESH_TOKEN_NAME")];
  if (refreshToken) await JWTService().removeRefreshToken(refreshToken);
  res.cookie(getEnv("ACCESS_TOKEN_NAME"), "", {
    ...accessTokenOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  res.cookie(getEnv("REFRESH_TOKEN_NAME"), "", {
    ...refreshTokenOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  return res
    .status(200)
    .json({ success: true, message: "Logged Out Successfully" });
});

// forget password
// ---------------
const forgetPassword = asyncHandler(async (req, res, next) => {
  if (!req?.body) return next(new CustomError(400, "Please Provide Email"));
  const { email } = req.body;
  if (!email) return next(new CustomError(400, "Please Provide Email"));
  const user = await Auth.findOne({ email });
  if (!user?._id) return next(new CustomError(404, "User Not Found"));
  const token = await JWTService().verificationToken(String(user?._id));
  if (!token) return next(new CustomError(400, "Error While Generating Token"));
  const resetPasswordUrl = `${getEnv("RESET_PASSWORD_URL")}/${token}`;
  console.log("reset password url----", resetPasswordUrl);
  let mailPage = returnMailPage(resetPasswordUrl);
  const isMailSent = await sendMail(email, "Reset Password", mailPage, true);
  if (!isMailSent)
    return next(new CustomError(500, "Some Error Occurred While Sending Mail"));
  return res.status(200).json({
    success: true,
    message: "Reset Password Link Sent Successfully Check Your MailBox",
  });
});

// reset you password
// ------------------
const resetPassword = asyncHandler(async (req, res, next) => {
  if (!req?.body)
    return next(
      new CustomError(400, "Please Provide Reset Token and New Password")
    );
  const { password, confirmPassword, token } = req.body;
  if (!token || !password)
    return next(
      new CustomError(400, "Please Provide Reset Token and New Password")
    );
  const decoded = await JWTService().verifyToken(
    token,
    getEnv("VERIFICATION_TOKEN_SECRET")
  );
  if (!decoded?._id)
    return next(new CustomError(400, "Token Expired Try Again"));
  const user = await Auth.findById(decoded._id);
  if (!user) return next(new CustomError(400, "User Not Found"));
  user.password = password;
  await user.save();
  return res.status(200).json({
    success: true,
    message: "Password Reset Successfully Now You Can Login",
  });
});

// get My Profile
// --------------
const getMyProfile = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;

  if (!isValidObjectId(userId)) {
    return next(new CustomError(400, "Invalid user ID"));
  }

  const user = await Auth.findById(userId).select("-password -__v");
  if (!user) {
    return next(new CustomError(404, "User not found"));
  }

  return res.status(200).json({
    success: true,
    data: user,
  });
});

// update my profile
// -----------------
const updateMyProfile = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;
  if (!isValidObjectId(userId))
    return next(new CustomError(401, "Invalid User Id"));
  const user = await Auth.findById(userId);
  if (!user) return next(new CustomError(402, "User Not Found"));
  if (!req?.body)
    return next(new CustomError(403, "Please Provide at least one field"));
  const formData = req.body;
  const { name, email, phone, gender, companyName, designation } =
    formData || {};
  const image = req.file;
  if (
    !name &&
    !email &&
    !phone &&
    !gender &&
    !companyName &&
    !designation &&
    !image
  ) {
    return next(new CustomError(403, "Please Provide at least one field"));
  }
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (gender) user.gender = gender;
  if (companyName) user.companyName = companyName;
  if (designation) user.designation = designation;
  if (image) {
    if (user?.image?.public_id)
      await removeFromCloudinary(user?.image?.public_id, "image");
    const newImage = await uploadOnCloudinary(image, "auth");
    if (!newImage)
      return next(new CustomError(403, "Error While Uploading Image"));
    user.image = { public_id: newImage.public_id, url: newImage.secure_url };
  }
  await user.save();
  return res.status(200).json({
    newuser: user,
    success: true,
    message: "Profile Updated Successfully",
  });
});

export {
  forgetPassword,
  getMyProfile,
  login,
  logout,
  register,
  resetPassword,
  updateMyProfile,
  signup
};

import { Settings } from "../models/settings.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";

// Get admin settings (full access)
const getSettings = asyncHandler(async (req, res, next) => {
    const settings = await Settings.getSettings();

    res.status(200).json({
        success: true,
        data: settings,
    });
});

// Update settings (Admin only)
const updateSettings = asyncHandler(async (req, res, next) => {
    const {
        siteName,
        siteDescription,
        contactEmail,
        contactPhone,
        currency,
        timezone,
        maintenanceMode,
    } = req.body;

    let settings = await Settings.getSettings();

    if (siteName) settings.siteName = siteName;
    if (siteDescription) settings.siteDescription = siteDescription;
    if (contactEmail) settings.contactEmail = contactEmail;
    if (contactPhone) settings.contactPhone = contactPhone;
    if (currency) settings.currency = currency;
    if (timezone) settings.timezone = timezone;
    if (typeof maintenanceMode !== "undefined") settings.maintenanceMode = maintenanceMode;

    await settings.save();

    res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        data: settings,
    });
});

// Get public config (limited access for frontend initialization)
const getPublicConfig = asyncHandler(async (req, res, next) => {
    const settings = await Settings.getSettings();

    // Only return necessary public info
    const publicConfig = {
        siteName: settings.siteName,
        siteDescription: settings.siteDescription,
        currency: settings.currency,
        maintenanceMode: settings.maintenanceMode,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
    };

    res.status(200).json({
        success: true,
        data: publicConfig,
    });
});

export { getSettings, updateSettings, getPublicConfig };

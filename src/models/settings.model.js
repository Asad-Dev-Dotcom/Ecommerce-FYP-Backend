import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        siteName: {
            type: String,
            default: "E-commerce Store",
            trim: true,
        },
        siteDescription: {
            type: String,
            default: "Welcome to our online store",
            trim: true,
        },
        contactEmail: {
            type: String,
            default: "admin@example.com",
            trim: true,
            lowercase: true,
        },
        contactPhone: {
            type: String,
            default: "+1234567890",
            trim: true,
        },
        currency: {
            type: String,
            default: "USD",
            enum: ["USD", "EUR", "GBP", "JPY", "PKR"],
        },
        timezone: {
            type: String,
            default: "UTC",
        },
        maintenanceMode: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Ensure only one document exists
settingsSchema.statics.getSettings = async function () {
    const settings = await this.findOne();
    if (settings) return settings;
    return await this.create({});
};

export const Settings = mongoose.model("Settings", settingsSchema);

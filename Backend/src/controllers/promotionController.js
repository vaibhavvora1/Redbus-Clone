import Promotion from "../models/Promotion.js";

export const getPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch promotions",
    });
  }
};

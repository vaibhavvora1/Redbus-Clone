import Operator from "../models/Operator.js";

export const getOperators = async (req, res) => {
  try {
    const operators = await Operator.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: operators.length,
      data: operators,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch operators",
    });
  }
};

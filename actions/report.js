"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function getMonthlyStats(date) {
  const { userId } = auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  try {
    const transactions = await db.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return transactions.reduce(
      (stats, t) => {
        const amount = t.amount.toNumber();
        if (t.type === "EXPENSE") {
          stats.totalExpenses += amount;
          stats.byCategory[t.category] =
            (stats.byCategory[t.category] || 0) + amount;
        } else {
          stats.totalIncome += amount;
        }
        return stats;
      },
      {
        totalExpenses: 0,
        totalIncome: 0,
        byCategory: {},
        transactionCount: transactions.length,
      }
    );
  } catch (error) {
    console.error("Error fetching monthly stats:", error);
    throw new Error("Failed to fetch monthly stats");
  }
}

export async function getFinancialInsights(stats) {
  const { userId } = auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // If Gemini API key is not available, return fallback insights
    if (!process.env.GEMINI_API_KEY) {
      return [
        "Your highest expense category might need attention.",
        "Consider setting up a budget for better financial management.",
        "Track your recurring expenses to identify potential savings.",
        "Save about 20% of your income each month for future goals.",
        "Try to increase your income sources for better financial stability."
      ];
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const month = new Date().toLocaleString("default", { month: "long" });
    
    const prompt = `
      Analyze this financial data and provide 5 concise, actionable insights.
      Focus on spending patterns and practical advice.
      Keep it friendly and conversational.

      Financial Data for ${month}:
      - Total Income: ₹${stats.totalIncome}
      - Total Expenses: ₹${stats.totalExpenses}
      - Net Income: ₹${stats.totalIncome - stats.totalExpenses}
      - Expense Categories: ${Object.entries(stats.byCategory)
        .map(([category, amount]) => `${category}: ₹${amount}`)
        .join(", ")}

      Format the response as a JSON array of strings, like this:
      ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"]
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
      "Save about 20% of your income each month for future goals.",
      "Try to increase your income sources for better financial stability."
    ];
  }
} 
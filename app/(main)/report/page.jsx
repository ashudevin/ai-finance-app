import { Suspense } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BarChart3, LineChart } from "lucide-react";
import { auth } from "@clerk/nextjs";
import { db } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Demo data is only used if we can't get real user data
const DEMO_DATA = {
  stats: {
    totalIncome: 25000,
    totalExpenses: 18500,
    byCategory: {
      housing: 6500,
      groceries: 3200,
      transportation: 2000,
      entertainment: 1800,
      utilities: 3000,
      dining: 2000,
    },
    transactionCount: 15,
  },
  insights: [
    "Your housing expenses are 35% of your total spending - aim to keep housing costs under 30% of your income.",
    "Consider setting up automatic transfers to a savings account for better financial management.",
    "Your entertainment spending is well-balanced relative to your overall budget.",
    "Track your recurring subscriptions - you may find services you no longer use.",
    "Setting aside 10-15% of your income for long-term savings will help build financial security."
  ]
};

function LoadingCard() {
  return (
    <Card className="w-full h-40 animate-pulse">
      <CardContent className="p-6">
        <div className="h-7 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
      </CardContent>
    </Card>
  );
}

function AIInsights({ insights, totalIncome, totalExpenses }) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Financial Insights
            </CardTitle>
            <CardDescription>AI-powered analysis of your financial data</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Month: {format(new Date(), "MMMM yyyy")}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="text-lg font-semibold mb-4">Smart Recommendations</h3>
        <ul className="space-y-6">
          {insights?.map((insight, index) => (
            <li key={index} className="flex gap-3 bg-slate-50 p-4 rounded-md border border-slate-100">
              <Badge className="h-6 w-6 rounded-full flex items-center justify-center mt-0.5 bg-purple-100 text-purple-700 hover:bg-purple-200">
                {index + 1}
              </Badge>
              <div>
                <p className="text-slate-700">{insight}</p>
              </div>
            </li>
          ))}
        </ul>
        
        <div className="mt-8 flex gap-4 justify-end">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              View Dashboard
            </Button>
          </Link>
          <Link href="/account">
            <Button className="gap-2">
              <LineChart className="h-4 w-4" />
              View Transactions
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to generate AI insights without external API calls
function generateLocalInsights(stats) {
  const insights = [];
  
  // Calculate spending percentages for common categories
  const totalExpenses = stats.totalExpenses;
  const spendingByCategory = {};
  
  if (totalExpenses > 0) {
    Object.entries(stats.byCategory || {}).forEach(([category, amount]) => {
      spendingByCategory[category] = (amount / totalExpenses) * 100;
    });
  }
  
  // Add insights based on data patterns
  if (stats.totalIncome > 0) {
    const savingsRate = ((stats.totalIncome - stats.totalExpenses) / stats.totalIncome) * 100;
    
    if (savingsRate < 20) {
      insights.push("Your savings rate is below 20%. Consider exploring ways to increase your income or reduce non-essential expenses.");
    } else {
      insights.push(`Great job saving ${savingsRate.toFixed(0)}% of your income this month! Financial experts recommend saving 15-20% of your income.`);
    }
  }
  
  // Housing expense insight
  if (spendingByCategory['housing'] && spendingByCategory['housing'] > 30) {
    insights.push(`Housing expenses are ${spendingByCategory['housing'].toFixed(0)}% of your spending. Financial advisors suggest keeping housing costs under 30% of your budget.`);
  }
  
  // Adding general insights
  insights.push("Track your recurring subscriptions - you may find services you no longer use that could be canceled.");
  
  if (Object.keys(spendingByCategory).length > 0) {
    // Find highest category
    const highestCategory = Object.entries(spendingByCategory)
      .sort((a, b) => b[1] - a[1])[0];
    
    insights.push(`Your highest spending category is ${highestCategory[0]} at ${highestCategory[1].toFixed(0)}% of your expenses. Consider if there are ways to optimize this area.`);
  }
  
  insights.push("Setting aside money for an emergency fund covering 3-6 months of expenses provides important financial security.");
  
  return insights;
}

// Function to get monthly stats directly from user transactions
async function getUserMonthlyStats(date) {
  try {
    const { userId } = auth();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const transactions = await db.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate stats from transactions
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
    return null;
  }
}

export default async function FinancialReportPage() {
  // Default to demo data
  let data = { ...DEMO_DATA };
  
  try {
    // Try to get real user data directly from transactions
    const currentDate = new Date();
    const userStats = await getUserMonthlyStats(currentDate);
    
    // Only use real data if we got it successfully
    if (userStats) {
      const insights = generateLocalInsights(userStats);
      data = { 
        stats: userStats, 
        insights: insights || DEMO_DATA.insights 
      };
    }
  } catch (error) {
    console.error("Error generating report:", error);
    // We'll continue with the demo data if anything fails
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Financial Insights Report
        </h1>
        <p className="text-muted-foreground">
          AI-powered analysis of your financial habits and personalized recommendations
        </p>
      </div>

      <Suspense fallback={<LoadingCard />}>
        <AIInsights 
          insights={data.insights} 
          totalIncome={data.stats.totalIncome}
          totalExpenses={data.stats.totalExpenses}
        />
      </Suspense>
    </div>
  );
} 
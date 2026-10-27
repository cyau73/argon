import { NextRequest, NextResponse } from "next/server";
import {
  fetchPremises,
  fetchYearlyDrilldown,
  fetchMonthlyDrilldown,
  fetchDailyDrilldown,
  fetchHalfHourlyDrilldown,
} from "@/lib/consumption";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "yearly";
  const premiseId = searchParams.get("premiseId") || "premise-313-somerset";

  if (type === "premises") {
    const premises = await fetchPremises();
    return NextResponse.json(premises);
  }

  if (type === "yearly") {
    const data = await fetchYearlyDrilldown(premiseId);
    return NextResponse.json(data);
  }

  if (type === "monthly") {
    const year = parseInt(searchParams.get("year") || "2020", 10);
    const data = await fetchMonthlyDrilldown(premiseId, year);
    return NextResponse.json(data);
  }

  if (type === "daily") {
    const year = parseInt(searchParams.get("year") || "2020", 10);
    const month = parseInt(searchParams.get("month") || "8", 10);
    const data = await fetchDailyDrilldown(premiseId, year, month);
    return NextResponse.json(data);
  }

  if (type === "halfhourly") {
    const year = parseInt(searchParams.get("year") || "2020", 10);
    const month = parseInt(searchParams.get("month") || "8", 10);
    const day = parseInt(searchParams.get("day") || "15", 10);
    const data = await fetchHalfHourlyDrilldown(premiseId, year, month, day);
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
}
